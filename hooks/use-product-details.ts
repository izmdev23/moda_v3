import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewItem, VariantItem } from '../components/product-details-components';
import { supabase } from '../supabase/supabaseClient';
import { queryKeys } from '../utils/query-keys';

// Re-export component types so consumers import from one place
export type { ReviewItem, VariantItem };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductDetails {
    readonly id: number;
    readonly uid: string;
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly thumbnailUrl: string;
    readonly ratingAvg: number;
    readonly totalSales: number;
    readonly shopId: number | null;
    readonly shopName: string;
    readonly tags: string[];
    readonly createdAt: string;
}

export interface ShopInfo {
    readonly uid: string;
    readonly shopName: string;
    readonly city: string;
    readonly province: string;
    readonly sellerId: number;
}

// ─── Fetch fns ────────────────────────────────────────────────────────────────

async function fetchProductByUid(uid: string): Promise<ProductDetails | null> {
    const { data } = await supabase
        .from('products')
        .select('*')
        .eq('uid', uid)
        .is('deleted_at', null)
        .single();

    if (!data) return null;

    return {
        id: data.id,
        uid: data.uid,
        name: data.name,
        description: data.description,
        category: data.category,
        thumbnailUrl: data.thumbnail_url,
        ratingAvg: data.rating_avg,
        totalSales: data.total_sales,
        shopId: data.shop_id,
        shopName: data.shop_name,
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
        createdAt: data.created_at,
    };
}

async function fetchShopForProduct(shopId: number): Promise<ShopInfo | null> {
    const { data } = await supabase
        .from('shops')
        .select('uid, shop_name, city, province, user_id')
        .eq('id', shopId)
        .single();

    if (!data) return null;
    return {
        uid: data.uid,
        shopName: data.shop_name,
        city: data.city,
        province: data.province,
        sellerId: data.user_id,
    };
}

async function fetchProductImages(productId: number): Promise<string[]> {
    const { data } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });

    return data?.map((img) => img.image_url) ?? [];
}

async function fetchProductVariants(productId: number): Promise<VariantItem[]> {
    const { data } = await supabase
        .from('product_variants')
        .select('id, uid, name, price, sale_price, sale_start_date, sale_end_date, stock, image_url, extracted_outfit_url, is_full_body')
        .eq('product_id', productId);

    return (data ?? []).map((v) => ({
        uid: v.uid,
        id: v.id,
        name: v.name,
        price: v.price,
        salePrice: v.sale_price,
        saleStartDate: v.sale_start_date,
        saleEndDate: v.sale_end_date,
        stock: v.stock,
        imageUrl: v.image_url,
        extractedOutfitUrl: v.extracted_outfit_url,
        isFullBody: v.is_full_body,
    }));
}

async function fetchRatingCount(productId: number): Promise<number> {
    const { data } = await supabase
        .from('ratings')
        .select('id')
        .eq('product_id', productId);

    return data?.length ?? 0;
}

async function fetchUserRating(productId: number, userId: number): Promise<number | null> {
    const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('product_id', productId)
        .eq('user_id', userId)
        .maybeSingle();

    return data?.rating ?? null;
}

async function fetchReviews(productId: number, offset: number): Promise<ReviewItem[]> {
    const PAGE_SIZE = 5;
    const { data: reviewData } = await supabase
        .from('reviews')
        .select('*, users!inner(first_name, last_name, avatar_url)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    if (!reviewData) return [];

    return Promise.all(
        reviewData.map(async (r) => {
            const { data: imgData } = await supabase
                .from('review_images')
                .select('image_url')
                .eq('review_id', r.id)
                .order('sort_order', { ascending: true });

            const userInfo = r.users as unknown as { first_name: string; last_name: string; avatar_url: string | null } | null;

            return {
                uid: r.uid,
                userName: userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : 'Anonymous',
                avatarUrl: userInfo?.avatar_url ?? null,
                rating: 0,
                reviewText: r.review_text,
                imageUrls: imgData?.map((i) => i.image_url) ?? [],
                createdAt: r.created_at,
            };
        })
    );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Fetch a single product by its public UID. */
export function useProduct(uid: string | null) {
    return useQuery({
        queryKey: queryKeys.products.byUid(uid ?? ''),
        queryFn: () => fetchProductByUid(uid!),
        enabled: uid !== null && uid.length > 0,
        staleTime: 2 * 60 * 1000,
    });
}

/** Fetch the shop that owns a product (by shop numeric ID). */
export function useShopForProduct(shopId: number | null) {
    return useQuery({
        queryKey: queryKeys.shopForProduct(shopId ?? 0),
        queryFn: () => fetchShopForProduct(shopId!),
        enabled: shopId !== null,
        staleTime: 5 * 60 * 1000,
    });
}

/** Fetch sorted image URLs for a product. */
export function useProductImages(productId: number | null) {
    return useQuery({
        queryKey: queryKeys.productImages(productId ?? 0),
        queryFn: () => fetchProductImages(productId!),
        enabled: productId !== null,
        staleTime: 10 * 60 * 1000, // Images rarely change
    });
}

/** Fetch all variants for a product. */
export function useProductVariants(productId: number | null) {
    return useQuery({
        queryKey: queryKeys.productVariants(productId ?? 0),
        queryFn: () => fetchProductVariants(productId!),
        enabled: productId !== null,
        staleTime: 2 * 60 * 1000,
    });
}

/** Fetch the total number of ratings for a product. */
export function useRatingCount(productId: number | null) {
    return useQuery({
        queryKey: queryKeys.productRatings(productId ?? 0),
        queryFn: () => fetchRatingCount(productId!),
        enabled: productId !== null,
        staleTime: 2 * 60 * 1000,
    });
}

/** Fetch the current user's rating for a product (null if not rated). */
export function useUserRating(productId: number | null, userId: number | null) {
    return useQuery({
        queryKey: queryKeys.userRating(productId ?? 0, userId ?? 0),
        queryFn: () => fetchUserRating(productId!, userId!),
        enabled: productId !== null && userId !== null,
        staleTime: 5 * 60 * 1000,
    });
}

/** Fetch the first page of reviews for a product. */
export function useReviews(productId: number | null) {
    return useQuery({
        queryKey: queryKeys.reviews(productId ?? 0),
        queryFn: () => fetchReviews(productId!, 0),
        enabled: productId !== null,
        staleTime: 2 * 60 * 1000,
    });
}

/**
 * Mutation: upsert the current user's rating for a product.
 * Invalidates both the rating count and the user's individual rating.
 */
export function useUpsertRating(productId: number | null, userId: number | null) {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (rating: number) => {
            if (!productId || !userId) throw new Error('Missing productId or userId');

            const { data: existing } = await supabase
                .from('ratings')
                .select('uid')
                .eq('product_id', productId)
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase.from('ratings').update({ rating }).eq('uid', existing.uid);
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabase.from('ratings').insert({ product_id: productId, user_id: userId, rating });
                if (error) throw new Error(error.message);
            }
        },
        onSuccess: () => {
            if (productId) void qc.invalidateQueries({ queryKey: queryKeys.productRatings(productId) });
            if (productId && userId) void qc.invalidateQueries({ queryKey: queryKeys.userRating(productId, userId) });
        },
    });
}

/**
 * Mutation: add a product to the cart (insert or increment existing quantity).
 * Invalidates the cart cache for the user if a userId is provided.
 */
export function useAddToCart(userId: number | null) {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async ({
            productId,
            variantId,
            quantity,
        }: {
            productId: number;
            variantId: number;
            quantity: number;
        }) => {
            if (!userId) throw new Error('Not authenticated');

            const { data: existing } = await supabase
                .from('cart_items')
                .select('id, quantity, uid')
                .eq('user_id', userId)
                .eq('variant_id', variantId)
                .maybeSingle();

            if (existing) {
                const newQty = Math.min(existing.quantity + quantity, 99);
                const { error } = await supabase
                    .from('cart_items')
                    .update({ quantity: newQty })
                    .eq('uid', existing.uid);
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabase.from('cart_items').insert({
                    user_id: userId,
                    product_id: productId,
                    variant_id: variantId,
                    quantity,
                });
                if (error) throw new Error(error.message);
            }
        },
        onSuccess: () => {
            if (userId !== null) {
                void qc.invalidateQueries({ queryKey: queryKeys.cart(userId) });
            }
        },
    });
}
