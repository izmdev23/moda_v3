import { QueryFunctionContext, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { CatalogProductItem, ShopCardItem } from '../components/catalog-components';
import { Tables } from '../supabase/database.types';
import { supabase } from '../supabase/supabaseClient';
import type { CatalogFilters } from '../utils/query-keys';
import { queryKeys } from '../utils/query-keys';

// Re-export component types so consumers import from one place
export type { CatalogProductItem, ShopCardItem };

// ─── Constants ────────────────────────────────────────────────────────────────

export const CATALOG_PAGE_SIZE = 20;
const CATALOG_CACHE_STALE_TIME_MS = 10 * 60 * 1000;
const CATALOG_CACHE_GC_TIME_MS = 30 * 60 * 1000;
const CATALOG_QUERY_TIMEOUT_MS = 12000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductWithVariants = Tables<'products'> & {
    product_variants?: Array<Tables<'product_variants'>>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function withTimeout<T>(
    promise: PromiseLike<T>,
    label: string,
    timeoutMs: number = CATALOG_QUERY_TIMEOUT_MS
): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    try {
        return await Promise.race([Promise.resolve(promise), timeoutPromise]);
    } finally {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
    }
}

export const transformProduct = (row: ProductWithVariants): CatalogProductItem => {
    const variants = row.product_variants ?? [];
    const prices = variants.map((v) => v.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    const now = new Date();

    const saleVariant = variants.find(
        (v) =>
            v.sale_price !== null &&
            v.sale_start_date !== null &&
            v.sale_end_date !== null &&
            new Date(v.sale_start_date) <= now &&
            new Date(v.sale_end_date) >= now
    );

    return {
        uid: row.uid,
        name: row.name,
        thumbnailUrl: row.thumbnail_url ?? '',
        minPrice,
        maxPrice,
        totalStock,
        salePrice: saleVariant?.sale_price ?? null,
        originalPriceForSale: saleVariant ? saleVariant.price : null,
        rating: row.rating_avg ?? 0,
        totalSales: row.total_sales ?? 0,
    };
};

// ─── Fetch fns ────────────────────────────────────────────────────────────────

async function fetchProductsPage(
    filters: CatalogFilters,
    pageParam: number
): Promise<{ items: CatalogProductItem[]; nextOffset: number | null }> {
    let q = supabase
        .from('products')
        .select('*, product_variants(*)')
        .is('deleted_at', null);

    if (filters.query.trim()) {
        if (filters.isShopSearch) {
            q = q.ilike('shop_name', `%${filters.query.trim()}%`);
        } else {
            q = q.textSearch('search_vector', filters.query.trim(), { type: 'plain' }) as typeof q;
        }
    }

    if (filters.category) q = q.eq('category', filters.category);
    if (filters.minRating !== null) q = q.gte('rating_avg', filters.minRating);

    switch (filters.sort) {
        case 'best_rating':  q = q.order('rating_avg', { ascending: false }); break;
        case 'best_sellers': q = q.order('total_sales', { ascending: false }); break;
        case 'by_shop':      q = q.order('shop_name', { ascending: true }); break;
        default:             q = q.order('created_at', { ascending: false }); break;
    }

    q = q.range(pageParam, pageParam + CATALOG_PAGE_SIZE - 1);

    const { data, error } = await withTimeout(q, 'catalog.products.page');
    if (error) {
        throw new Error(error.message);
    }

    let transformed = ((data ?? []) as ProductWithVariants[]).map(transformProduct);

    // Client-side price filter (variant data required)
    transformed = transformed.filter((p) => {
        if (filters.minPrice !== null && p.minPrice < filters.minPrice) return false;
        if (filters.maxPrice !== null && p.maxPrice > filters.maxPrice) return false;
        return true;
    });

    if (filters.sort === 'price_asc') {
        transformed.sort((a, b) => a.minPrice - b.minPrice);
    } else if (filters.sort === 'price_desc') {
        transformed.sort((a, b) => b.maxPrice - a.maxPrice);
    }

    const nextOffset = transformed.length >= CATALOG_PAGE_SIZE ? pageParam + CATALOG_PAGE_SIZE : null;
    return { items: transformed, nextOffset };
}

async function fetchFeaturedShops(): Promise<ShopCardItem[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await withTimeout(
        supabase
        .from('order_items')
        .select('shop_id')
        .gte('created_at', sevenDaysAgo)
        .not('shop_id', 'is', null)
        .limit(100),
        'catalog.shops.order_items'
    );

    if (error) {
        throw new Error(error.message);
    }

    if (!data || data.length === 0) return [];

    const countMap: Record<number, number> = {};
    for (const item of data) {
        if (item.shop_id === null) continue;
        countMap[item.shop_id] = (countMap[item.shop_id] ?? 0) + 1;
    }
    const topShopIds = Object.entries(countMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id]) => Number(id));

    if (topShopIds.length === 0) return [];

    const { data: shopData, error: shopError } = await withTimeout(
        supabase
        .from('shops')
        .select('uid, shop_name, city, province, banner_url, id')
        .in('id', topShopIds),
        'catalog.shops.details'
    );

    if (shopError) {
        throw new Error(shopError.message);
    }

    return (shopData ?? []).map((s) => ({
        uid: s.uid,
        shopName: s.shop_name,
        city: s.city,
        province: s.province,
        bannerUrl: s.banner_url ?? null,
        orderCount: countMap[s.id] ?? 0,
    }));
}

async function fetchTrendingProducts(): Promise<CatalogProductItem[]> {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: viewData, error: viewError } = await withTimeout(
        supabase
        .from('product_views')
        .select('product_id')
        .gte('viewed_at', twoDaysAgo)
        .limit(200),
        'catalog.trending.views'
    );

    if (viewError) {
        throw new Error(viewError.message);
    }

    if (!viewData || viewData.length === 0) return [];

    const viewCount: Record<number, number> = {};
    for (const v of viewData) {
        viewCount[v.product_id] = (viewCount[v.product_id] ?? 0) + 1;
    }
    const topIds = Object.entries(viewCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([id]) => Number(id));

    const { data: prodData, error: prodError } = await withTimeout(
        supabase
        .from('products')
        .select('*, product_variants(*)')
        .in('id', topIds)
        .is('deleted_at', null),
        'catalog.trending.products'
    );

    if (prodError) {
        throw new Error(prodError.message);
    }

    return ((prodData ?? []) as ProductWithVariants[]).map(transformProduct);
}

async function fetchRecommendations(userId: number): Promise<{ products: CatalogProductItem[]; hasActivity: boolean }> {
    const { data: actData, error: activityError } = await withTimeout(
        supabase
        .from('user_activity_log')
        .select('id')
        .eq('user_id', userId)
        .limit(1),
        'catalog.recommendations.activity'
    );

    if (activityError) {
        throw new Error(activityError.message);
    }

    const hasActivity = (actData?.length ?? 0) > 0;
    if (!hasActivity) return { products: [], hasActivity: false };

    const { data: recData, error: recommendationsError } = await withTimeout(
        supabase
        .from('user_recommendations')
        .select('product_id, score')
        .eq('user_id', userId)
        .order('score', { ascending: false })
        .limit(20),
        'catalog.recommendations.list'
    );

    if (recommendationsError) {
        throw new Error(recommendationsError.message);
    }

    if (!recData || recData.length === 0) return { products: [], hasActivity: true };

    const productIds = recData.map((r) => r.product_id);
    const { data: prodData, error: productsError } = await withTimeout(
        supabase
        .from('products')
        .select('*, product_variants(*)')
        .in('id', productIds)
        .is('deleted_at', null),
        'catalog.recommendations.products'
    );

    if (productsError) {
        throw new Error(productsError.message);
    }

    return {
        products: ((prodData ?? []) as ProductWithVariants[]).map(transformProduct),
        hasActivity: true,
    };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Infinite query for the main catalog product grid.
 * Each page fetches `CATALOG_PAGE_SIZE` products starting at `pageParam` offset.
 * Filter/sort state is included in the query key — changing any filter
 * automatically resets to page 1 (no manual offset tracking needed).
 */
export function useCatalogProducts(filters: CatalogFilters) {
    return useInfiniteQuery({
        queryKey: queryKeys.products.list(filters),
        queryFn: ({ pageParam }: QueryFunctionContext) =>
            fetchProductsPage(filters, pageParam as number),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextOffset,
        placeholderData: (previousData) => previousData,
        staleTime: CATALOG_CACHE_STALE_TIME_MS,
        gcTime: CATALOG_CACHE_GC_TIME_MS,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 0,
    });
}

/**
 * Query for the featured shops carousel.
 * Stale after 5 minutes — shop popularity changes slowly.
 */
export function useFeaturedShops() {
    return useQuery({
        queryKey: queryKeys.products.featured,
        queryFn: fetchFeaturedShops,
        placeholderData: (previousData) => previousData,
        staleTime: CATALOG_CACHE_STALE_TIME_MS,
        gcTime: CATALOG_CACHE_GC_TIME_MS,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 0,
    });
}

/**
 * Query for the trending products carousel.
 * Stale after 2 minutes — trend data changes more frequently.
 */
export function useTrendingProducts() {
    return useQuery({
        queryKey: queryKeys.products.trending,
        queryFn: fetchTrendingProducts,
        placeholderData: (previousData) => previousData,
        staleTime: CATALOG_CACHE_STALE_TIME_MS,
        gcTime: CATALOG_CACHE_GC_TIME_MS,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 0,
    });
}

/**
 * Query for personalised product recommendations.
 * Only enabled when a userId is available.
 */
export function useRecommendations(userId: number | null) {
    return useQuery({
        queryKey: queryKeys.products.recommendations(userId ?? 0),
        queryFn: () => fetchRecommendations(userId!),
        enabled: userId !== null,
        placeholderData: (previousData) => previousData,
        staleTime: CATALOG_CACHE_STALE_TIME_MS,
        gcTime: CATALOG_CACHE_GC_TIME_MS,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 0,
    });
}
