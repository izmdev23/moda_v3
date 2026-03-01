import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { CatalogFilterPanel, CatalogFilterState, CatalogProductItem, CatalogSearchBar, CatalogSortPicker, FeaturedShopsCarousel, RecommendedSection, ShopCardItem, SortOption, TrendingProductsCarousel } from '../../components/catalog-components';
import { AppHeader } from '../../components/ui/app-header';
import { EmptyList } from '../../components/ui/empty-list';
import { LoadingModal } from '../../components/ui/loading-modal';
import { ProductCard } from '../../components/ui/product-card';
import { SafeScreen } from '../../components/ui/safe-screen';
import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { GRID_MAX_COLUMN_WIDTH, GRID_MIN_COLUMN_WIDTH } from '../../utils/constants';
import { UserRole } from '../../utils/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 32;
const GAP = 16;
const COLUMN_WIDTH = Math.min(GRID_MAX_COLUMN_WIDTH, Math.max(GRID_MIN_COLUMN_WIDTH, (SCREEN_WIDTH - PADDING - GAP) / 2));

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductWithVariants = Tables<'products'> & {
    product_variants?: Array<Tables<'product_variants'>>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Transform raw product row to CatalogProductItem */
const transformProduct = (row: ProductWithVariants): CatalogProductItem => {
    const variants = row.product_variants ?? [];
    const prices = variants.map((v) => v.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
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
        thumbnailUrl: row.thumbnail_url,
        minPrice,
        maxPrice,
        salePrice: saleVariant?.sale_price ?? null,
        originalPriceForSale: saleVariant ? saleVariant.price : null,
        rating: row.rating_avg ?? 0,
        totalSales: row.total_sales ?? 0,
    };
};

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Catalog page — the main product discovery screen.
 * Shows featured shops, trending, recommendations, search/filter/sort, and paginated grid.
 */
export default function CatalogScreen(): React.JSX.Element {
    const [products, setProducts] = useState<CatalogProductItem[]>([]);
    const [featuredShops, setFeaturedShops] = useState<ShopCardItem[]>([]);
    const [trendingProducts, setTrendingProducts] = useState<CatalogProductItem[]>([]);
    const [recommendedProducts, setRecommendedProducts] = useState<CatalogProductItem[]>([]);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [shopsLoading, setShopsLoading] = useState<boolean>(true);
    const [trendingLoading, setTrendingLoading] = useState<boolean>(true);
    const [recommendedLoading, setRecommendedLoading] = useState<boolean>(true);

    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isShopSearch, setIsShopSearch] = useState<boolean>(false);
    const [filters, setFilters] = useState<CatalogFilterState>({
        category: null,
        minPrice: null,
        maxPrice: null,
        minRating: null,
    });
    const [sortOption, setSortOption] = useState<SortOption>('newest');
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [showSort, setShowSort] = useState<boolean>(false);

    const [pageOffset, setPageOffset] = useState<number>(0);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [hasActivity, setHasActivity] = useState<boolean>(false);

    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<UserRole>('buyer');

    const currentUserId = useRef<number | null>(null);
    const isMounted = useRef<boolean>(true);

    // ─── Fetch user ──────────────────────────────────────────────────────────

    useEffect(() => {
        isMounted.current = true;
        const fetchUserData = async (): Promise<void> => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                const { data } = await supabase
                    .from('users')
                    .select('id, avatar_url, role')
                    .eq('auth_id', session.user.id)
                    .single();

                if (data && isMounted.current) {
                    currentUserId.current = data.id;
                    setUserAvatar(data.avatar_url ?? null);
                    setUserRole(data.role as UserRole);
                    void fetchRecommendations(data.id);
                } else if (isMounted.current) {
                    setRecommendedLoading(false);
                }
            } else if (isMounted.current) {
                setRecommendedLoading(false);
            }
        };
        void fetchUserData();
        return () => { isMounted.current = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Fetch featured shops ────────────────────────────────────────────────

    const fetchFeaturedShops = useCallback(async (): Promise<void> => {
        if (!isMounted.current) return;
        setShopsLoading(true);
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('order_items')
                .select('shop_id')
                .gte('created_at', sevenDaysAgo)
                .not('shop_id', 'is', null)
                .limit(100);

            if (!data || !isMounted.current) return;

            const countMap: Record<number, number> = {};
            for (const item of data) {
                if (item.shop_id === null) continue;
                countMap[item.shop_id] = (countMap[item.shop_id] ?? 0) + 1;
            }
            const topShopIds = Object.entries(countMap)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([id]) => Number(id));

            if (topShopIds.length > 0) {
                const { data: shopData } = await supabase
                    .from('shops')
                    .select('uid, shop_name, city, province, banner_url')
                    .in('id', topShopIds);

                if (shopData && isMounted.current) {
                    const shops: ShopCardItem[] = shopData.map((s) => ({
                        uid: s.uid,
                        shopName: s.shop_name,
                        city: s.city,
                        province: s.province,
                        bannerUrl: s.banner_url ?? null,
                        orderCount: countMap[topShopIds.find((id) => true) ?? 0] ?? 0,
                    }));
                    setFeaturedShops(shops);
                }
            }
        } catch {
            // Fail silently
        } finally {
            if (isMounted.current) setShopsLoading(false);
        }
    }, []);

    // ─── Fetch trending ──────────────────────────────────────────────────────

    const fetchTrending = useCallback(async (): Promise<void> => {
        if (!isMounted.current) return;
        setTrendingLoading(true);
        try {
            const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            const { data: viewData } = await supabase
                .from('product_views')
                .select('product_id')
                .gte('viewed_at', twoDaysAgo)
                .limit(200);

            if (!viewData || viewData.length === 0 || !isMounted.current) return;

            const viewCount: Record<number, number> = {};
            for (const v of viewData) {
                viewCount[v.product_id] = (viewCount[v.product_id] ?? 0) + 1;
            }
            const topIds = Object.entries(viewCount)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 20)
                .map(([id]) => Number(id));

            const { data: prodData } = await supabase
                .from('products')
                .select('*, product_variants(*)')
                .in('id', topIds)
                .is('deleted_at', null);

            if (prodData && isMounted.current) {
                setTrendingProducts((prodData as ProductWithVariants[]).map(transformProduct));
            }
        } catch {
            // Fail silently
        } finally {
            if (isMounted.current) setTrendingLoading(false);
        }
    }, []);

    // ─── Fetch recommendations ───────────────────────────────────────────────

    const fetchRecommendations = useCallback(async (userId: number): Promise<void> => {
        if (!isMounted.current) return;
        setRecommendedLoading(true);
        try {
            const { data: actData } = await supabase
                .from('user_activity_log')
                .select('id')
                .eq('user_id', userId)
                .limit(1);

            const userHasActivity = (actData?.length ?? 0) > 0;
            if (isMounted.current) setHasActivity(userHasActivity);

            if (!userHasActivity) return;

            const { data: recData } = await supabase
                .from('user_recommendations')
                .select('product_id, score')
                .eq('user_id', userId)
                .order('score', { ascending: false })
                .limit(20);

            if (!recData || recData.length === 0 || !isMounted.current) return;

            const productIds = recData.map((r) => r.product_id);
            const { data: prodData } = await supabase
                .from('products')
                .select('*, product_variants(*)')
                .in('id', productIds)
                .is('deleted_at', null);

            if (prodData && isMounted.current) {
                setRecommendedProducts((prodData as ProductWithVariants[]).map(transformProduct));
            }
        } catch {
            // Fail silently
        } finally {
            if (isMounted.current) setRecommendedLoading(false);
        }
    }, []);

    // ─── Fetch products ──────────────────────────────────────────────────────

    const fetchProducts = useCallback(async (opts: {
        offset: number;
        query: string;
        filterState: CatalogFilterState;
        sort: SortOption;
        shopSearch: boolean;
        append: boolean;
    }): Promise<void> => {
        if (!isMounted.current) return;
        if (opts.append) setIsFetchingMore(true);
        else setIsLoading(true);

        try {
            let query = supabase
                .from('products')
                .select('*, product_variants(*)')
                .is('deleted_at', null);

            if (opts.query.trim()) {
                if (opts.shopSearch) {
                    query = query.ilike('shop_name', `%${opts.query.trim()}%`);
                } else {
                    query = query.textSearch('search_vector', opts.query.trim(), { type: 'plain' }) as typeof query;
                }
            }

            if (opts.filterState.category) {
                query = query.eq('category', opts.filterState.category);
            }
            if (opts.filterState.minRating !== null) {
                query = query.gte('rating_avg', opts.filterState.minRating);
            }

            switch (opts.sort) {
                case 'newest': query = query.order('created_at', { ascending: false }); break;
                case 'best_rating': query = query.order('rating_avg', { ascending: false }); break;
                case 'best_sellers': query = query.order('total_sales', { ascending: false }); break;
                case 'by_shop': query = query.order('shop_name', { ascending: true }); break;
                default: query = query.order('created_at', { ascending: false }); break;
            }

            query = query.range(opts.offset, opts.offset + PAGE_SIZE - 1);

            const { data } = await query;
            let transformed = ((data ?? []) as ProductWithVariants[]).map(transformProduct);

            // Client-side price filter (requires variant data)
            transformed = transformed.filter((p) => {
                if (opts.filterState.minPrice !== null && p.minPrice < opts.filterState.minPrice) return false;
                if (opts.filterState.maxPrice !== null && p.maxPrice > opts.filterState.maxPrice) return false;
                return true;
            });

            if (opts.sort === 'price_asc') {
                transformed.sort((a, b) => a.minPrice - b.minPrice);
            } else if (opts.sort === 'price_desc') {
                transformed.sort((a, b) => b.maxPrice - a.maxPrice);
            }

            if (!isMounted.current) return;

            if (opts.append) {
                setProducts((prev) => [...prev, ...transformed]);
            } else {
                setProducts(transformed);
            }
            setHasMore(transformed.length >= PAGE_SIZE);
            setPageOffset(opts.offset + PAGE_SIZE);
        } catch {
            // Keep existing products on error
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
                setIsFetchingMore(false);
                setIsRefreshing(false);
            }
        }
    }, []);

    // ─── Initial load ────────────────────────────────────────────────────────

    useEffect(() => {
        void fetchFeaturedShops();
        void fetchTrending();
        void fetchProducts({
            offset: 0,
            query: '',
            filterState: { category: null, minPrice: null, maxPrice: null, minRating: null },
            sort: 'newest',
            shopSearch: false,
            append: false,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Re-fetch on filter/search/sort change ───────────────────────────────

    const isFirstRender = useRef<boolean>(true);
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        setPageOffset(0);
        void fetchProducts({ offset: 0, query: searchQuery, filterState: filters, sort: sortOption, shopSearch: isShopSearch, append: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, filters, sortOption, isShopSearch]);

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleRefresh = useCallback(async (): Promise<void> => {
        setIsRefreshing(true);
        await Promise.all([fetchFeaturedShops(), fetchTrending()]);
        void fetchProducts({ offset: 0, query: searchQuery, filterState: filters, sort: sortOption, shopSearch: isShopSearch, append: false });
    }, [fetchFeaturedShops, fetchTrending, fetchProducts, searchQuery, filters, sortOption, isShopSearch]);

    const handleEndReached = useCallback((): void => {
        if (!isFetchingMore && hasMore) {
            void fetchProducts({ offset: pageOffset, query: searchQuery, filterState: filters, sort: sortOption, shopSearch: isShopSearch, append: true });
        }
    }, [isFetchingMore, hasMore, pageOffset, searchQuery, filters, sortOption, isShopSearch, fetchProducts]);

    const handleProductPress = useCallback((uid: string): void => {
        router.push({ pathname: '/home/product-details' as string, params: { uid } } as Parameters<typeof router.push>[0]);
    }, []);

    const handleShopPress = useCallback((uid: string): void => {
        router.push({ pathname: '/home/shop-landing' as string, params: { uid } } as Parameters<typeof router.push>[0]);
    }, []);

    const handleClearFilters = useCallback((): void => {
        setFilters({ category: null, minPrice: null, maxPrice: null, minRating: null });
        setSearchQuery('');
        setIsShopSearch(false);
        setSortOption('newest');
    }, []);

    const hasActiveFilters = filters.category !== null || filters.minPrice !== null || filters.maxPrice !== null || filters.minRating !== null;

    // ─── Render helpers ───────────────────────────────────────────────────────

    const renderItem = useCallback(({ item }: { item: CatalogProductItem }): React.JSX.Element => (
        <ProductCard
            uid={item.uid}
            name={item.name}
            thumbnailUrl={item.thumbnailUrl}
            minPrice={item.minPrice}
            maxPrice={item.maxPrice}
            salePrice={item.salePrice}
            originalPriceForSale={item.originalPriceForSale}
            rating={item.rating}
            totalSales={item.totalSales}
            onPress={handleProductPress}
            width={COLUMN_WIDTH}
        />
    ), [handleProductPress]);

    const ListHeader = useCallback((): React.JSX.Element => (
        <View>
            <FeaturedShopsCarousel shops={featuredShops} onShopPress={handleShopPress} isLoading={shopsLoading} />
            <TrendingProductsCarousel products={trendingProducts} onProductPress={handleProductPress} isLoading={trendingLoading} />
            <RecommendedSection products={recommendedProducts} onProductPress={handleProductPress} isLoading={recommendedLoading} hasActivity={hasActivity} />

            <View style={styles.divider} />

            <CatalogSearchBar onSearch={setSearchQuery} onToggleShopSearch={setIsShopSearch} isShopSearch={isShopSearch} />
            <View style={styles.controlsRow}>
                <TouchableOpacity
                    style={[styles.controlBtn, hasActiveFilters && styles.controlBtnActive]}
                    onPress={() => setShowFilters(true)}
                >
                    <Text style={[styles.controlBtnText, hasActiveFilters && styles.controlBtnTextActive]}>
                        ⚙️ Filter{hasActiveFilters ? ' ●' : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={() => setShowSort(true)}>
                    <Text style={styles.controlBtnText}>↕️ Sort</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.sectionHeading}>All Products</Text>
        </View>
    ), [
        featuredShops, shopsLoading, trendingProducts, trendingLoading,
        recommendedProducts, recommendedLoading, hasActivity, handleShopPress,
        handleProductPress, isShopSearch, hasActiveFilters,
    ]);

    const ListFooter = useCallback((): React.JSX.Element | null =>
        isFetchingMore ? (
            <View style={styles.footerLoading}>
                <Text style={styles.footerText}>Loading more…</Text>
            </View>
        ) : null,
        [isFetchingMore]);

    const ListEmpty = useCallback((): React.JSX.Element => (
        <EmptyList
            icon={<Text style={styles.emptyIcon}>🛍️</Text>}
            message="No products found"
            submessage={hasActiveFilters || searchQuery ? 'Try adjusting your search or filters.' : 'Check back later!'}
            actionButton={hasActiveFilters || searchQuery ? { label: 'Clear Filters', onPress: handleClearFilters } : undefined}
        />
    ), [hasActiveFilters, searchQuery, handleClearFilters]);

    return (
        <SafeScreen style={styles.root}>
            <AppHeader
                userAvatarUrl={userAvatar}
                userRole={userRole}
            />
            <LoadingModal isVisible={isLoading && products.length === 0} message="Loading catalog…" />

            <FlatList
                data={products}
                keyExtractor={(item) => item.uid}
                numColumns={2}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                ListEmptyComponent={!isLoading ? ListEmpty : null}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.3}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#F44336']} />
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={styles.columnWrapper}
            />

            <CatalogFilterPanel visible={showFilters} filters={filters} onApply={setFilters} onClose={() => setShowFilters(false)} />
            <CatalogSortPicker visible={showSort} selected={sortOption} onSelect={setSortOption} onClose={() => setShowSort(false)} />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    listContent: { paddingBottom: 32 },
    columnWrapper: { paddingHorizontal: 8 },
    divider: { height: 4, backgroundColor: '#F0F0F0', marginVertical: 8 },
    controlsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
    controlBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E9ECEF',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    controlBtnActive: { borderColor: '#F44336', backgroundColor: 'rgba(244,67,54,0.07)' },
    controlBtnText: { fontSize: 14, fontWeight: '600', color: '#525F7F' },
    controlBtnTextActive: { color: '#F44336' },
    sectionHeading: {
        fontSize: 17,
        fontWeight: '700',
        color: '#32325D',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    footerLoading: { paddingVertical: 16, alignItems: 'center' },
    footerText: { color: '#ADB5BD', fontSize: 13 },
    emptyIcon: { fontSize: 40 },
});
