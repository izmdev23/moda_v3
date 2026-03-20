import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// Using Alert for simple feedback — Toast will be added in Phase 20
import { AddToCartSection, ChatWithSellerButton, InlineRatingStars, ProductImageCarousel, ReviewItem, ReviewsList, SaleCountdownTimer, ShopHeader, VariantSelector } from '../../components/product-details-components';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useAddToCart, useProduct, useProductImages, useProductVariants, useRatingCount, useReviews, useShopForProduct, useUpsertRating, useUserRating, type VariantItem } from '../../hooks/use-product-details';
import { supabase } from '../../supabase/supabaseClient';
import { formatPrice } from '../../utils/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const REVIEWS_PAGE_SIZE = 5;
const VTON_ENABLED_CATEGORIES: readonly string[] = ['tops', 'bottoms', 'full_body'];

function isVtonCategoryEnabled(category: string): boolean {
    return VTON_ENABLED_CATEGORIES.includes(category);
}

function formatCategoryLabel(category: string): string {
    return category
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}

// ─── Product Details Skeleton ─────────────────────────────────────────────────

const ProductDetailsSkeleton: React.FC = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
        <SkeletonLoader height={320} borderRadius={0} />
        <View style={detailsSkeletonStyles.body}>
            <SkeletonLoader height={22} width="85%" style={{ marginBottom: 10 }} />
            <SkeletonLoader height={14} width="40%" style={{ marginBottom: 14 }} />
            <SkeletonLoader height={28} width="30%" style={{ marginBottom: 16 }} />
            <SkeletonLoader height={12} style={{ marginBottom: 6 }} />
            <SkeletonLoader height={12} style={{ marginBottom: 6 }} />
            <SkeletonLoader height={12} width="70%" style={{ marginBottom: 20 }} />
            <SkeletonLoader height={48} borderRadius={10} />
        </View>
    </ScrollView>
);

const detailsSkeletonStyles = StyleSheet.create({
    body: { padding: 16 },
});

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Product Details page — shows full product info, images, variant selection,
 * add to cart, inline ratings, reviews, and chat-with-seller.
 * Route param: `uid` — the product's public UID.
 */
export default function ProductDetailsScreen(): React.JSX.Element {
    const params = useLocalSearchParams<{ uid: string }>();
    const productUid = params.uid ?? '';
    const { theme } = useTheme();

    // ── Identity ───────────────────────────────────────────────────────────
    const { data: currentUser } = useCurrentUser();
    const userId = currentUser?.id ?? null;

    // ── Server-state queries ───────────────────────────────────────────────
    const { data: product, isLoading: productLoading } = useProduct(productUid || null);
    const { data: shop } = useShopForProduct(product?.shopId ?? null);
    const { data: images = [] } = useProductImages(product?.id ?? null);
    const { data: variants = [] } = useProductVariants(product?.id ?? null);
    const { data: ratingCount = 0 } = useRatingCount(product?.id ?? null);
    const { data: userRating = null } = useUserRating(product?.id ?? null, userId);
    const { data: initialReviews = [] } = useReviews(product?.id ?? null);

    // ── Mutations ──────────────────────────────────────────────────────────
    const addToCartMutation = useAddToCart(userId);
    const upsertRatingMutation = useUpsertRating(product?.id ?? null, userId);

    // ── Local UI state ─────────────────────────────────────────────────────
    const [selectedVariant, setSelectedVariant] = useState<VariantItem | null>(null);
    const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

    // Review pagination (initial page from query, subsequent pages manual)
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [reviewOffset, setReviewOffset] = useState<number>(REVIEWS_PAGE_SIZE);
    const [hasMoreReviews, setHasMoreReviews] = useState<boolean>(true);
    const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState<boolean>(false);

    // Debounce view logging
    const viewLogged = useRef<boolean>(false);

    // ── Sync initial reviews into local state ──────────────────────────────
    useEffect(() => {
        setReviews(initialReviews);
        setHasMoreReviews(initialReviews.length >= REVIEWS_PAGE_SIZE);
        setReviewOffset(REVIEWS_PAGE_SIZE);
    }, [initialReviews]);

    // ── Log product view (once per mount, fire-and-forget) ─────────────────
    useEffect(() => {
        if (!product || viewLogged.current) return;
        viewLogged.current = true;

        const logView = async (): Promise<void> => {
            try {
                await supabase.from('product_views').insert({
                    product_id: product.id,
                    user_id: userId ?? undefined,
                });
                if (userId !== null) {
                    await supabase.from('user_activity_log').insert({
                        user_id: userId,
                        activity_type: 'view',
                        product_id: product.id,
                    });
                }
            } catch {
                // Silently fail
            }
        };
        void logView();
    }, [product, userId]);

    // ── Fetch additional review pages ─────────────────────────────────────

    const fetchMoreReviews = useCallback(async (productId: number, offset: number): Promise<void> => {
        setIsLoadingMoreReviews(true);
        try {
            const { data: reviewData } = await supabase
                .from('reviews')
                .select('*, users!inner(first_name, last_name, avatar_url)')
                .eq('product_id', productId)
                .order('created_at', { ascending: false })
                .range(offset, offset + REVIEWS_PAGE_SIZE - 1);

            if (!reviewData) return;

            const reviewsWithImages: ReviewItem[] = await Promise.all(
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

            setReviews((prev) => [...prev, ...reviewsWithImages]);
            setHasMoreReviews(reviewData.length >= REVIEWS_PAGE_SIZE);
            setReviewOffset(offset + REVIEWS_PAGE_SIZE);
        } catch {
            // Silently fail
        } finally {
            setIsLoadingMoreReviews(false);
        }
    }, []);

    const handleLoadMoreReviews = useCallback((): void => {
        if (product && !isLoadingMoreReviews && hasMoreReviews) {
            void fetchMoreReviews(product.id, reviewOffset);
        }
    }, [product, isLoadingMoreReviews, hasMoreReviews, reviewOffset, fetchMoreReviews]);

    // ── Handlers ───────────────────────────────────────────────────────────

    const handleAddToCart = useCallback((quantity: number): void => {
        if (!selectedVariant || !product) return;

        addToCartMutation.mutate(
            { productId: product.id, variantId: selectedVariant.id, quantity },
            {
                onSuccess: () => Alert.alert('✓ Added to Cart', `${product.name} (${selectedVariant.name}) × ${quantity}`),
                onError: () => Alert.alert('Error', 'Failed to add to cart. Please try again.'),
            }
        );
    }, [selectedVariant, product, addToCartMutation]);

    const handleRate = useCallback((rating: number): void => {
        upsertRatingMutation.mutate(rating, {
            onError: () => Alert.alert('Error', 'Failed to submit rating. Please try again.'),
        });
    }, [upsertRatingMutation]);

    const handleChatWithSeller = useCallback(async (): Promise<void> => {
        if (!shop || userId === null || !product) return;

        setIsChatLoading(true);
        try {
            const { data: existing } = await supabase
                .from('chat_threads')
                .select('uid')
                .eq('buyer_id', userId)
                .eq('seller_id', shop.sellerId)
                .eq('shop_id', product.shopId ?? 0)
                .maybeSingle();

            if (existing) {
                router.push({ pathname: '/home/chat-thread' as string, params: { uid: existing.uid } } as Parameters<typeof router.push>[0]);
            } else {
                const { data: newThread } = await supabase
                    .from('chat_threads')
                    .insert({
                        buyer_id: userId,
                        seller_id: shop.sellerId,
                        shop_id: product.shopId ?? 0,
                        product_id: product.id,
                    })
                    .select('uid')
                    .single();

                if (newThread) {
                    router.push({ pathname: '/home/chat-thread' as string, params: { uid: newThread.uid } } as Parameters<typeof router.push>[0]);
                }
            }
        } catch {
            Alert.alert('Error', 'Could not open chat. Please try again.');
        } finally {
            setIsChatLoading(false);
        }
    }, [shop, userId, product]);

    const handleWriteReview = useCallback((): void => {
        if (!product) return;
        router.push({ pathname: '/home/review-form' as string, params: { productUid: product.uid } } as Parameters<typeof router.push>[0]);
    }, [product]);

    const handleVisitShop = useCallback((): void => {
        if (!shop) return;
        router.push({ pathname: '/home/shop-landing' as string, params: { uid: shop.uid } } as Parameters<typeof router.push>[0]);
    }, [shop]);

    const handleOpenVirtualTryOn = useCallback((): void => {
        if (!product) return;

        if (!isVtonCategoryEnabled(product.category)) {
            Alert.alert('Virtual Try-On Unavailable', 'Virtual try-on is only available for tops, bottoms, and full_body products.');
            return;
        }

        router.push({
            pathname: '/home/virtual-tryon' as string,
            params: {
                productId: String(product.id),
                productName: product.name,
                garmentImageUrl: images[0] ?? product.thumbnailUrl,
                productCategory: product.category,
                userId: userId !== null ? String(userId) : '',
            },
        } as Parameters<typeof router.push>[0]);
    }, [images, product, userId]);

    // ── Sale info for selected variant ─────────────────────────────────────

    const now = new Date();
    const activeSale =
        selectedVariant !== null &&
        selectedVariant.salePrice !== null &&
        selectedVariant.salePrice !== undefined &&
        selectedVariant.saleStartDate != null &&
        selectedVariant.saleEndDate != null &&
        new Date(selectedVariant.saleStartDate as string) <= now &&
        new Date(selectedVariant.saleEndDate as string) >= now;

    // ── Render ─────────────────────────────────────────────────────────────

    if (productLoading) {
        return (
            <SafeScreen>
                <ProductDetailsSkeleton />
            </SafeScreen>
        );
    }

    if (!product) {
        return (
            <SafeScreen style={styles.errorContainer}>
                <Text style={styles.errorIcon}>😕</Text>
                <Text style={[styles.errorText, { color: theme.textPrimary }]}>Product not found</Text>
                <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
                    <Text style={[styles.backBtnText, { color: theme.white }]}>Go Back</Text>
                </TouchableOpacity>
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={styles.root}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Image carousel */}
                <ProductImageCarousel
                    imageUrls={images}
                    thumbnailUrl={product.thumbnailUrl}
                    showVton={isVtonCategoryEnabled(product.category)}
                    onVtonPress={handleOpenVirtualTryOn}
                />

                {/* Shop header */}
                {shop && (
                    <ShopHeader
                        shopName={shop.shopName}
                        city={shop.city}
                        province={shop.province}
                        onVisitShop={handleVisitShop}
                    />
                )}

                {/* Product Info */}
                <View style={[styles.infoSection, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.productName, { color: theme.textPrimary }]}>{product.name}</Text>

                    {/* Category & tags */}
                    <View style={styles.categoryRow}>
                        <Text style={[styles.categoryChip, { backgroundColor: `${theme.primary}1A`, color: theme.primary }]}>
                            {formatCategoryLabel(product.category)}
                        </Text>
                        {product.tags.slice(0, 4).map((tag, idx) => (
                            <Text key={idx} style={[styles.tagChip, { backgroundColor: theme.background, color: theme.textSecondary, borderColor: theme.border }]}>{tag}</Text>
                        ))}
                    </View>

                    {/* Selected variant price */}
                    {selectedVariant && (
                        <View style={styles.priceRow}>
                            {activeSale ? (
                                <>
                                    <Text style={[styles.salePriceText, { color: theme.error }]}>{formatPrice(selectedVariant.salePrice ?? 0)}</Text>
                                    <Text style={[styles.originalPriceText, { color: theme.gray }]}>{formatPrice(selectedVariant.price)}</Text>
                                </>
                            ) : (
                                <Text style={[styles.priceText, { color: theme.primary }]}>{formatPrice(selectedVariant.price)}</Text>
                            )}
                        </View>
                    )}

                    {/* Sale countdown */}
                    {activeSale && selectedVariant?.saleEndDate && (
                        <SaleCountdownTimer saleEndDate={selectedVariant.saleEndDate} />
                    )}

                    {/* Total sales */}
                    {product.totalSales > 0 && (
                        <Text style={[styles.salesText, { color: theme.textSecondary }]}>🛒 {product.totalSales} sold</Text>
                    )}

                    {/* Description */}
                    <Text style={[styles.descriptionLabel, { color: theme.textPrimary }]}>Description</Text>
                    <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>{product.description}</Text>
                </View>

                {/* Variant selection */}
                {variants.length > 0 && (
                    <VariantSelector
                        variants={variants}
                        selectedUid={selectedVariant?.uid ?? null}
                        onSelect={setSelectedVariant}
                    />
                )}

                {/* Add to Cart */}
                <AddToCartSection
                    onAddToCart={handleAddToCart}
                    isLoading={addToCartMutation.isPending}
                    maxStock={selectedVariant?.stock ?? 0}
                    isDisabled={selectedVariant === null}
                />

                {/* Chat with Seller */}
                {shop && userId !== null && (
                    <ChatWithSellerButton onPress={handleChatWithSeller} isLoading={isChatLoading} />
                )}

                {/* Rating */}
                <InlineRatingStars
                    averageRating={product.ratingAvg ?? 0}
                    ratingCount={ratingCount}
                    userRating={userRating}
                    onRate={handleRate}
                    isSubmitting={upsertRatingMutation.isPending}
                />

                {/* Reviews */}
                <ReviewsList
                    reviews={reviews}
                    isLoading={isLoadingMoreReviews}
                    onLoadMore={handleLoadMoreReviews}
                    hasMore={hasMoreReviews}
                    onWriteReview={handleWriteReview}
                />
            </ScrollView>

        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    scrollContent: { paddingBottom: 48 },
    infoSection: {
        padding: 16,
        marginBottom: 4,
    },
    productName: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 10,
        lineHeight: 28,
    },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    categoryChip: {
        fontSize: 12,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    tagChip: {
        fontSize: 11,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
    priceText: { fontSize: 24, fontWeight: '700' },
    salePriceText: { fontSize: 24, fontWeight: '700' },
    originalPriceText: {
        fontSize: 16,
        textDecorationLine: 'line-through',
    },
    salesText: { fontSize: 12, marginTop: 6 },
    descriptionLabel: {
        fontSize: 15,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 6,
    },
    descriptionText: {
        fontSize: 14,
        lineHeight: 21,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    errorIcon: { fontSize: 48, marginBottom: 16 },
    errorText: { fontSize: 18, fontWeight: '600', marginBottom: 20 },
    backBtn: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
    },
    backBtnText: { fontWeight: '700', fontSize: 15 },
});
