import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ScrollView, StyleSheet, Text, View
} from 'react-native';
// Using Alert for simple feedback — Toast will be added in Phase 20
import { AddToCartSection, ChatWithSellerButton, InlineRatingStars, ProductImageCarousel, ReviewItem, ReviewsList, SaleCountdownTimer, ShopHeader, VariantSelector } from '../../components/product-details-components';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useAddToCart, useMyReview, useProduct, useProductImages, useProductVariants, useRatingAverage, useRatingCount, useReviews, useShopForProduct, useUserRating, type VariantItem } from '../../hooks/use-product-details';
import { supabase } from '../../supabase/supabaseClient';
import { formatPrice, getInventoryStockLabel, getInventoryStockState } from '../../utils/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const REVIEWS_PAGE_SIZE = 5;
const VTON_ENABLED_CATEGORIES: readonly string[] = ['headwear', 'upperwear', 'lowerwear', 'footwear'];
const EMPTY_IMAGE_URLS: readonly string[] = [];
const EMPTY_VARIANTS: readonly VariantItem[] = [];
const EMPTY_REVIEWS: readonly ReviewItem[] = [];
const INVALID_URL_LITERALS: readonly string[] = ['null', 'undefined', 'n/a', 'na'];

function isVtonCategoryEnabled(category: string): boolean {
    return VTON_ENABLED_CATEGORIES.includes(category);
}

function formatCategoryLabel(category: string): string {
    return category
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}

function decodeHtmlEntities(content: string): string {
    return content
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
}

function parseHtmlDescription(content: string): string {
    const withLineBreaks = content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ');

    const withoutTags = withLineBreaks.replace(/<[^>]*>/g, ' ');
    const decoded = decodeHtmlEntities(withoutTags);

    return decoded
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function normalizeNonEmptyUrl(url: string | null | undefined): string | null {
    if (typeof url !== 'string') {
        return null;
    }

    const trimmedUrl = url.trim();
    if (trimmedUrl.length === 0) {
        return null;
    }

    const normalizedLowercaseUrl = trimmedUrl.toLowerCase();
    if (INVALID_URL_LITERALS.includes(normalizedLowercaseUrl)) {
        return null;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
        return null;
    }

    return trimmedUrl;
}

function resolveVariantPreviewImageUrl(variant: VariantItem | null | undefined): string | null {
    const extractedImageUrl = normalizeNonEmptyUrl(variant?.extractedOutfitUrl);
    if (extractedImageUrl !== null) {
        return extractedImageUrl;
    }

    return normalizeNonEmptyUrl(variant?.imageUrl);
}

function resolveProductThumbnailUrl(
    fallbackThumbnailUrl: string,
    variants: readonly VariantItem[],
): string {
    const normalizedFallbackThumbnailUrl = normalizeNonEmptyUrl(fallbackThumbnailUrl);
    if (normalizedFallbackThumbnailUrl !== null) {
        return normalizedFallbackThumbnailUrl;
    }

    if (variants.length > 1) {
        const firstVariantImage = resolveVariantPreviewImageUrl(variants[0] ?? null);
        if (firstVariantImage !== null) {
            return firstVariantImage;
        }
    }

    return '';
}

function buildProductCarouselImages(
    selectedVariant: VariantItem | null,
    variants: readonly VariantItem[],
    imageUrls: readonly string[],
    thumbnailUrl: string,
): string[] {
    const dedupedUrls: string[] = [];

    const pushUniqueUrl = (candidateUrl: string | null): void => {
        if (candidateUrl === null) {
            return;
        }

        if (!dedupedUrls.includes(candidateUrl)) {
            dedupedUrls.push(candidateUrl);
        }
    };

    for (const imageUrl of imageUrls) {
        pushUniqueUrl(normalizeNonEmptyUrl(imageUrl));
    }

    pushUniqueUrl(normalizeNonEmptyUrl(thumbnailUrl));

    const selectedVariantImageUrl = resolveVariantPreviewImageUrl(selectedVariant);
    if (selectedVariantImageUrl !== null) {
        pushUniqueUrl(selectedVariantImageUrl);
    }

    for (const variant of variants) {
        pushUniqueUrl(resolveVariantPreviewImageUrl(variant));
    }

    if (dedupedUrls.length === 0) {
        pushUniqueUrl(normalizeNonEmptyUrl(thumbnailUrl));
        pushUniqueUrl(selectedVariantImageUrl);
    }

    return dedupedUrls;
}

function resolveTryOnGarmentImageUrl(
    selectedVariant: VariantItem | null,
    variants: readonly VariantItem[],
    images: readonly string[],
    fallbackThumbnailUrl: string,
): string {
    const selectedExtractedUrl = normalizeNonEmptyUrl(selectedVariant?.extractedOutfitUrl);
    if (selectedExtractedUrl !== null) {
        return selectedExtractedUrl;
    }

    const selectedVariantImageUrl = normalizeNonEmptyUrl(selectedVariant?.imageUrl);
    if (selectedVariantImageUrl !== null) {
        return selectedVariantImageUrl;
    }

    const firstExtractedVariant = variants.find((variant) => normalizeNonEmptyUrl(variant.extractedOutfitUrl) !== null) ?? null;
    const firstExtractedUrl = normalizeNonEmptyUrl(firstExtractedVariant?.extractedOutfitUrl);
    if (firstExtractedUrl !== null) {
        return firstExtractedUrl;
    }

    const firstVariantWithImage = variants.find((variant) => normalizeNonEmptyUrl(variant.imageUrl) !== null) ?? null;
    const firstVariantImageUrl = normalizeNonEmptyUrl(firstVariantWithImage?.imageUrl);
    if (firstVariantImageUrl !== null) {
        return firstVariantImageUrl;
    }

    const firstProductImageUrl = images.find((url) => normalizeNonEmptyUrl(url) !== null) ?? null;
    if (firstProductImageUrl !== null) {
        return firstProductImageUrl;
    }

    return fallbackThumbnailUrl;
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
    const params = useLocalSearchParams<{ uid: string; sellerView?: string }>();
    const productUid = params.uid ?? '';
    const { theme } = useTheme();

    // ── Identity ───────────────────────────────────────────────────────────
    const { data: currentUser } = useCurrentUser();
    const userId = currentUser?.id ?? null;
    const isSellerViewParam = params.sellerView === 'true';

    // ── Server-state queries ───────────────────────────────────────────────
    const { data: product, isLoading: productLoading } = useProduct(productUid || null);
    const { data: shop } = useShopForProduct(product?.shopId ?? null);
    const { data: imageData } = useProductImages(product?.id ?? null);
    const { data: variantData } = useProductVariants(product?.id ?? null);
    const { data: ratingCount = 0 } = useRatingCount(product?.id ?? null);
    const { data: liveAverageRating } = useRatingAverage(product?.id ?? null);
    const { data: userRating = null } = useUserRating(product?.id ?? null, userId);
    const { data: myReview } = useMyReview(product?.id ?? null, userId);
    const { data: reviewData } = useReviews(product?.id ?? null);

    const images: readonly string[] = imageData ?? EMPTY_IMAGE_URLS;
    const variants: readonly VariantItem[] = variantData ?? EMPTY_VARIANTS;
    const initialReviews: readonly ReviewItem[] = reviewData ?? EMPTY_REVIEWS;

    const isReadOnlySellerView =
        isSellerViewParam ||
        (currentUser?.role === 'seller' && userId !== null && shop?.sellerId === userId);
    const canShowChatWithSeller = shop !== null && userId !== null && !isReadOnlySellerView;
    const reviewButtonLabel = myReview !== null ? 'Edit Review' : 'Write a Review';

    const parsedDescription = useMemo<string>(() => {
        if (product === null || product === undefined) {
            return '';
        }

        return parseHtmlDescription(product.description);
    }, [product]);

    // ── Mutations ──────────────────────────────────────────────────────────
    const addToCartMutation = useAddToCart(userId);

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
                .select('id, uid, user_id, review_text, created_at')
                .eq('product_id', productId)
                .order('created_at', { ascending: false })
                .range(offset, offset + REVIEWS_PAGE_SIZE - 1);

            if (!reviewData) return;

            const typedReviewRows = reviewData as Array<{
                readonly id: number;
                readonly uid: string;
                readonly user_id: number;
                readonly review_text: string;
                readonly created_at: string;
            }>;

            const reviewIds = typedReviewRows.map((row) => row.id);
            const userIds = Array.from(new Set(typedReviewRows.map((row) => row.user_id)));

            const [imageResult, ratingResult, usersResult] = await Promise.all([
                supabase
                    .from('review_images')
                    .select('review_id, image_url')
                    .in('review_id', reviewIds)
                    .order('sort_order', { ascending: true }),
                supabase
                    .from('ratings')
                    .select('user_id, rating')
                    .eq('product_id', productId)
                    .in('user_id', userIds),
                supabase
                    .from('users')
                    .select('id, first_name, last_name, avatar_url')
                    .in('id', userIds),
            ]);

            const imageByReviewId = new Map<number, string[]>();
            for (const imageRow of (imageResult.data ?? []) as Array<{ readonly review_id: number; readonly image_url: string }>) {
                const existing = imageByReviewId.get(imageRow.review_id) ?? [];
                existing.push(imageRow.image_url);
                imageByReviewId.set(imageRow.review_id, existing);
            }

            const ratingByUserId = new Map<number, number>();
            for (const ratingRow of (ratingResult.data ?? []) as Array<{ readonly user_id: number; readonly rating: number }>) {
                ratingByUserId.set(ratingRow.user_id, ratingRow.rating);
            }

            const userById = new Map<number, { readonly first_name: string; readonly last_name: string; readonly avatar_url: string | null }>();
            for (const userRow of (usersResult.data ?? []) as Array<{ readonly id: number; readonly first_name: string; readonly last_name: string; readonly avatar_url: string | null }>) {
                userById.set(userRow.id, {
                    first_name: userRow.first_name,
                    last_name: userRow.last_name,
                    avatar_url: userRow.avatar_url,
                });
            }

            const reviewsWithImages: ReviewItem[] = typedReviewRows.map((reviewRow) => {
                const reviewer = userById.get(reviewRow.user_id);
                const firstName = reviewer?.first_name?.trim() ?? '';
                const lastName = reviewer?.last_name?.trim() ?? '';
                const fullName = `${firstName} ${lastName}`.trim();

                return {
                    uid: reviewRow.uid,
                    userName: fullName.length > 0 ? fullName : 'Moda User',
                    avatarUrl: reviewer?.avatar_url ?? null,
                    rating: ratingByUserId.get(reviewRow.user_id) ?? 0,
                    reviewText: reviewRow.review_text,
                    imageUrls: imageByReviewId.get(reviewRow.id) ?? [],
                    createdAt: reviewRow.created_at,
                };
            });

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
        if (isReadOnlySellerView) return;
        if (!selectedVariant || !product) return;

        addToCartMutation.mutate(
            { productId: product.id, variantId: selectedVariant.id, quantity },
            {
                onSuccess: () => AppAlert.alert('✓ Added to Cart', `${product.name} (${selectedVariant.name}) × ${quantity}`),
                onError: () => AppAlert.alert('Error', 'Failed to add to cart. Please try again.'),
            }
        );
    }, [isReadOnlySellerView, selectedVariant, product, addToCartMutation]);

    const handleRate = useCallback((rating: number): void => {
        if (isReadOnlySellerView) return;
        if (!product) return;

        router.push({
            pathname: '/home/review-form' as string,
            params: {
                productUid: product.uid,
                initialRating: String(rating),
            },
        } as Parameters<typeof router.push>[0]);
    }, [isReadOnlySellerView, product]);

    const handleChatWithSeller = useCallback(async (): Promise<void> => {
        if (isReadOnlySellerView) return;
        if (!shop || userId === null || !product) return;

        setIsChatLoading(true);
        try {
            const { data: existing, error: existingError } = await supabase
                .from('chat_threads')
                .select('uid')
                .eq('buyer_id', userId)
                .eq('seller_id', shop.sellerId)
                .eq('shop_id', product.shopId ?? 0)
                .eq('product_id', product.id)
                .maybeSingle();

            if (existingError !== null) {
                throw existingError;
            }

            if (existing) {
                router.push({
                    pathname: '/home/chat-thread' as string,
                    params: {
                        threadUid: existing.uid,
                        attachProduct: 'true',
                        linkProductUid: product.uid,
                        linkProductName: product.name,
                    },
                } as Parameters<typeof router.push>[0]);
            } else {
                const { data: newThread, error: newThreadError } = await supabase
                    .from('chat_threads')
                    .insert({
                        buyer_id: userId,
                        seller_id: shop.sellerId,
                        shop_id: product.shopId ?? 0,
                        product_id: product.id,
                    })
                    .select('uid')
                    .single();

                if (newThreadError !== null || newThread === null) {
                    const { data: fallbackThread, error: fallbackThreadError } = await supabase
                        .from('chat_threads')
                        .select('uid')
                        .eq('buyer_id', userId)
                        .eq('seller_id', shop.sellerId)
                        .eq('shop_id', product.shopId ?? 0)
                        .eq('product_id', product.id)
                        .maybeSingle();

                    if (fallbackThreadError !== null || fallbackThread === null) {
                        throw newThreadError ?? fallbackThreadError ?? new Error('Unable to open chat thread.');
                    }

                    router.push({
                        pathname: '/home/chat-thread' as string,
                        params: {
                            threadUid: fallbackThread.uid,
                            attachProduct: 'true',
                            linkProductUid: product.uid,
                            linkProductName: product.name,
                        },
                    } as Parameters<typeof router.push>[0]);

                    return;
                }

                router.push({
                    pathname: '/home/chat-thread' as string,
                    params: {
                        threadUid: newThread.uid,
                        attachProduct: 'true',
                        linkProductUid: product.uid,
                        linkProductName: product.name,
                    },
                } as Parameters<typeof router.push>[0]);
            }
        } catch {
            AppAlert.alert('Error', 'Could not open chat. Please try again.');
        } finally {
            setIsChatLoading(false);
        }
    }, [isReadOnlySellerView, shop, userId, product]);

    const handleWriteReview = useCallback((): void => {
        if (isReadOnlySellerView) return;
        if (!product) return;
        router.push({
            pathname: '/home/review-form' as string,
            params: {
                productUid: product.uid,
                existingReviewUid: myReview?.reviewUid ?? '',
            },
        } as Parameters<typeof router.push>[0]);
    }, [isReadOnlySellerView, myReview?.reviewUid, product]);

    const handleVisitShop = useCallback((): void => {
        if (isReadOnlySellerView) return;
        if (!shop) return;
        router.push({ pathname: '/home/shop-landing' as string, params: { uid: shop.uid } } as Parameters<typeof router.push>[0]);
    }, [isReadOnlySellerView, shop]);

    const handleOpenVirtualTryOn = useCallback((): void => {
        if (!product) return;

        if (!isVtonCategoryEnabled(product.category)) {
            AppAlert.alert('Virtual Try-On Unavailable', 'Virtual try-on is only available for headwear, upperwear, lowerwear, and footwear products.');
            return;
        }

        if (variants.length > 0 && selectedVariant === null) {
            AppAlert.alert('Select Variant', 'Please select a variant before starting virtual try-on.');
            return;
        }

        const garmentImageUrl = resolveTryOnGarmentImageUrl(selectedVariant, variants, images, product.thumbnailUrl);

        router.push({
            pathname: '/home/virtual-tryon' as string,
            params: {
                productId: String(product.id),
                productName: product.name,
                garmentImageUrl,
                productCategory: product.category,
                isFullBody: selectedVariant?.isFullBody === true ? 'true' : 'false',
                userId: userId !== null ? String(userId) : '',
            },
        } as Parameters<typeof router.push>[0]);
    }, [images, product, selectedVariant, userId, variants]);

    // ── Sale info for selected variant ─────────────────────────────────────

    const now = new Date();
    const activeSale =
        selectedVariant !== null &&
        selectedVariant.salePrice !== null &&
        selectedVariant.salePrice !== undefined &&
        selectedVariant.saleStartDate !== null &&
        selectedVariant.saleEndDate !== null &&
        new Date(selectedVariant.saleStartDate as string) <= now &&
        new Date(selectedVariant.saleEndDate as string) >= now;

    const selectedVariantStock = selectedVariant?.stock ?? 0;
    const selectedVariantStockLabel = getInventoryStockLabel(selectedVariantStock);
    const selectedVariantStockState = getInventoryStockState(selectedVariantStock);
    const selectedVariantStockColor = selectedVariantStockState === 'sold-out'
        ? theme.error
        : selectedVariantStockState === 'low-stock'
            ? theme.warning
            : theme.success;

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
                <RipplePressable style={[styles.backBtn, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
                    <Text style={[styles.backBtnText, { color: theme.white }]}>Go Back</Text>
                </RipplePressable>
            </SafeScreen>
        );
    }

    const resolvedThumbnailUrl = resolveProductThumbnailUrl(product.thumbnailUrl, variants);
    const carouselImageUrls = buildProductCarouselImages(selectedVariant, variants, images, resolvedThumbnailUrl);
    const averageRatingToDisplay = liveAverageRating ?? product.ratingAvg ?? 0;

    return (
        <SafeScreen style={styles.root}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Image carousel */}
                <ProductImageCarousel
                    imageUrls={carouselImageUrls}
                    thumbnailUrl={resolvedThumbnailUrl}
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
                        isVisitDisabled={isReadOnlySellerView}
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

                    {selectedVariant && (
                        <View style={styles.stockRow}>
                            <Text style={[styles.stockChip, { backgroundColor: `${selectedVariantStockColor}1A`, color: selectedVariantStockColor }]}>
                                {selectedVariantStockLabel}
                            </Text>
                            <Text style={[styles.stockCountText, { color: theme.textSecondary }]}>
                                {selectedVariantStock} left
                            </Text>
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
                    <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>
                        {parsedDescription.length > 0 ? parsedDescription : 'No description provided.'}
                    </Text>
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
                    isDisabled={selectedVariant === null || isReadOnlySellerView}
                    disabledLabel={isReadOnlySellerView ? 'Seller read-only mode' : 'Select a Variant'}
                />

                {/* Chat with Seller */}
                {canShowChatWithSeller && (
                    <ChatWithSellerButton
                        onPress={() => { void handleChatWithSeller(); }}
                        isLoading={isChatLoading}
                        isDisabled={isReadOnlySellerView}
                    />
                )}

                {/* Rating */}
                <InlineRatingStars
                    averageRating={averageRatingToDisplay}
                    ratingCount={ratingCount}
                    userRating={userRating}
                    onRate={handleRate}
                    isSubmitting={false}
                    isReadOnly={isReadOnlySellerView}
                />

                {/* Reviews */}
                <ReviewsList
                    reviews={reviews}
                    isLoading={isLoadingMoreReviews}
                    onLoadMore={handleLoadMoreReviews}
                    hasMore={hasMoreReviews}
                    onWriteReview={handleWriteReview}
                    reviewButtonLabel={reviewButtonLabel}
                    isReadOnly={isReadOnlySellerView}
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
    stockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    priceText: { fontSize: 24, fontWeight: '700' },
    salePriceText: { fontSize: 24, fontWeight: '700' },
    originalPriceText: {
        fontSize: 16,
        textDecorationLine: 'line-through',
    },
    stockChip: {
        fontSize: 12,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        textTransform: 'uppercase',
    },
    stockCountText: {
        fontSize: 12,
        fontWeight: '600',
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
