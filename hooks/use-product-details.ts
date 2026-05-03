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

export interface MyReviewDetails {
    readonly reviewId: number;
    readonly reviewUid: string;
    readonly reviewText: string;
    readonly rating: number;
    readonly imageUrls: readonly string[];
}

interface ReviewRow {
    readonly id: number;
    readonly uid: string;
    readonly user_id: number;
    readonly review_text: string;
    readonly created_at: string;
}

interface RatingRow {
    readonly user_id: number;
    readonly rating: number;
}

interface ReviewImageRow {
    readonly review_id: number;
    readonly image_url: string;
}

interface MyReviewRow {
    readonly id: number;
    readonly uid: string;
    readonly review_text: string;
}

interface MyRatingRow {
    readonly rating: number;
}

interface UserPublicRow {
    readonly id: number;
    readonly first_name: string;
    readonly last_name: string;
    readonly avatar_url: string | null;
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

async function fetchRatingAverage(productId: number): Promise<number> {
    const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('product_id', productId);

    if (data === null || data.length === 0) {
        return 0;
    }

    let total = 0;
    for (const row of data) {
        total += row.rating;
    }

    return total / data.length;
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
        .select('id, uid, user_id, review_text, created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    if (!reviewData) return [];
    const reviewRows = reviewData as ReviewRow[];
    const reviewIds = reviewRows.map((review) => review.id);
    const userIds = Array.from(new Set(reviewRows.map((review) => review.user_id)));

    const [ratingsResult, imagesResult, usersResult] = await Promise.all([
        supabase
            .from('ratings')
            .select('user_id, rating')
            .eq('product_id', productId)
            .in('user_id', userIds),
        supabase
            .from('review_images')
            .select('review_id, image_url')
            .in('review_id', reviewIds)
            .order('sort_order', { ascending: true }),
        supabase
            .from('users')
            .select('id, first_name, last_name, avatar_url')
            .in('id', userIds),
    ]);

    const ratingsByUserId = new Map<number, number>();
    for (const ratingRow of (ratingsResult.data ?? []) as RatingRow[]) {
        ratingsByUserId.set(ratingRow.user_id, ratingRow.rating);
    }

    const imagesByReviewId = new Map<number, string[]>();
    for (const imageRow of (imagesResult.data ?? []) as ReviewImageRow[]) {
        const existingImages = imagesByReviewId.get(imageRow.review_id) ?? [];
        existingImages.push(imageRow.image_url);
        imagesByReviewId.set(imageRow.review_id, existingImages);
    }

    const usersById = new Map<number, UserPublicRow>();
    for (const userRow of (usersResult.data ?? []) as UserPublicRow[]) {
        usersById.set(userRow.id, userRow);
    }

    return reviewRows.map((reviewRow) => {
        const reviewer = usersById.get(reviewRow.user_id);
        const firstName = reviewer?.first_name?.trim() ?? '';
        const lastName = reviewer?.last_name?.trim() ?? '';
        const fullName = `${firstName} ${lastName}`.trim();

        return {
            uid: reviewRow.uid,
            userName: fullName.length > 0 ? fullName : 'Moda User',
            avatarUrl: reviewer?.avatar_url ?? null,
            rating: ratingsByUserId.get(reviewRow.user_id) ?? 0,
            reviewText: reviewRow.review_text,
            imageUrls: imagesByReviewId.get(reviewRow.id) ?? [],
            createdAt: reviewRow.created_at,
        };
    });
}

async function fetchMyReview(productId: number, userId: number): Promise<MyReviewDetails | null> {
    const [reviewResult, ratingResult] = await Promise.all([
        supabase
            .from('reviews')
            .select('id, uid, review_text')
            .eq('product_id', productId)
            .eq('user_id', userId)
            .maybeSingle(),
        supabase
            .from('ratings')
            .select('rating')
            .eq('product_id', productId)
            .eq('user_id', userId)
            .maybeSingle(),
    ]);

    if (reviewResult.error !== null) {
        throw new Error(reviewResult.error.message);
    }

    if (ratingResult.error !== null) {
        throw new Error(ratingResult.error.message);
    }

    const reviewRow = reviewResult.data as MyReviewRow | null;
    if (reviewRow === null) {
        return null;
    }

    const { data: imageData, error: imageError } = await supabase
        .from('review_images')
        .select('review_id, image_url')
        .eq('review_id', reviewRow.id)
        .order('sort_order', { ascending: true });

    if (imageError !== null) {
        throw new Error(imageError.message);
    }

    const ratingRow = ratingResult.data as MyRatingRow | null;
    const imageRows = (imageData ?? []) as ReviewImageRow[];

    return {
        reviewId: reviewRow.id,
        reviewUid: reviewRow.uid,
        reviewText: reviewRow.review_text,
        rating: ratingRow?.rating ?? 0,
        imageUrls: imageRows.map((row) => row.image_url),
    };
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

/** Fetch the average rating for a product from live ratings rows. */
export function useRatingAverage(productId: number | null) {
    return useQuery({
        queryKey: queryKeys.productRatingAverage(productId ?? 0),
        queryFn: () => fetchRatingAverage(productId!),
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

/** Fetch the current user's existing review details for a product. */
export function useMyReview(productId: number | null, userId: number | null) {
    return useQuery({
        queryKey: queryKeys.myReview(productId ?? 0, userId ?? 0),
        queryFn: () => fetchMyReview(productId!, userId!),
        enabled: productId !== null && userId !== null,
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
            if (productId) void qc.invalidateQueries({ queryKey: queryKeys.productRatingAverage(productId) });
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
