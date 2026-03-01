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
import { AddToCartSection, ChatWithSellerButton, InlineRatingStars, ProductImageCarousel, ReviewItem, ReviewsList, SaleCountdownTimer, ShopHeader, VariantItem, VariantSelector, VirtualTryOnModal } from '../../components/product-details-components';
import { LoadingModal } from '../../components/ui/loading-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { supabase } from '../../supabase/supabaseClient';
import { lightPalette } from '../../utils/theme';
import { formatPrice } from '../../utils/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const REVIEWS_PAGE_SIZE = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopInfo {
    readonly uid: string;
    readonly shopName: string;
    readonly city: string;
    readonly province: string;
    readonly sellerId: number;
}

interface ProductDetails {
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

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Product Details page — shows full product info, images, variant selection,
 * add to cart, inline ratings, reviews, and chat-with-seller.
 * Route param: `uid` — the product's public UID.
 */
export default function ProductDetailsScreen(): React.JSX.Element {
    const params = useLocalSearchParams<{ uid: string }>();
    const productUid = params.uid ?? '';

    const [product, setProduct] = useState<ProductDetails | null>(null);
    const [shop, setShop] = useState<ShopInfo | null>(null);
    const [images, setImages] = useState<string[]>([]);
    const [variants, setVariants] = useState<VariantItem[]>([]);
    const [selectedVariant, setSelectedVariant] = useState<VariantItem | null>(null);
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [ratingCount, setRatingCount] = useState<number>(0);
    const [userRating, setUserRating] = useState<number | null>(null);
    const [currentUserNumericId, setCurrentUserNumericId] = useState<number | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);
    const [isRatingSubmitting, setIsRatingSubmitting] = useState<boolean>(false);
    const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
    const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState<boolean>(false);
    const [showVton, setShowVton] = useState<boolean>(false);

    const [reviewOffset, setReviewOffset] = useState<number>(0);
    const [hasMoreReviews, setHasMoreReviews] = useState<boolean>(true);

    // Debounce view logging
    const viewLogged = useRef<boolean>(false);

    // ─── Fetch current user ────────────────────────────────────────────────

    useEffect(() => {
        const getUser = async (): Promise<void> => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                const { data } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth_id', session.user.id)
                    .single();
                if (data) {
                    setCurrentUserNumericId(data.id);
                }
            }
        };
        void getUser();
    }, []);

    // ─── Fetch product details ─────────────────────────────────────────────

    useEffect(() => {
        if (!productUid) return;

        const fetchProduct = async (): Promise<void> => {
            setIsLoading(true);
            try {
                // Fetch product
                const { data: productData } = await supabase
                    .from('products')
                    .select('*')
                    .eq('uid', productUid)
                    .is('deleted_at', null)
                    .single();

                if (!productData) {
                    setIsLoading(false);
                    return;
                }

                const tags = Array.isArray(productData.tags) ? (productData.tags as string[]) : [];
                setProduct({
                    id: productData.id,
                    uid: productData.uid,
                    name: productData.name,
                    description: productData.description,
                    category: productData.category,
                    thumbnailUrl: productData.thumbnail_url,
                    ratingAvg: productData.rating_avg,
                    totalSales: productData.total_sales,
                    shopId: productData.shop_id,
                    shopName: productData.shop_name,
                    tags,
                    createdAt: productData.created_at,
                });

                // Fetch shop info
                if (productData.shop_id !== null) {
                    const { data: shopData } = await supabase
                        .from('shops')
                        .select('uid, shop_name, city, province, user_id')
                        .eq('id', productData.shop_id)
                        .single();

                    if (shopData) {
                        setShop({
                            uid: shopData.uid,
                            shopName: shopData.shop_name,
                            city: shopData.city,
                            province: shopData.province,
                            sellerId: shopData.user_id,
                        });
                    }
                }

                // Fetch product images
                const { data: imageData } = await supabase
                    .from('product_images')
                    .select('image_url')
                    .eq('product_id', productData.id)
                    .order('sort_order', { ascending: true });

                setImages(imageData?.map((img) => img.image_url) ?? []);

                // Fetch variants
                const { data: variantData } = await supabase
                    .from('product_variants')
                    .select('*')
                    .eq('product_id', productData.id);

                const mappedVariants: VariantItem[] = (variantData ?? []).map((v) => ({
                    uid: v.uid,
                    id: v.id,
                    name: v.name,
                    price: v.price,
                    salePrice: v.sale_price,
                    saleStartDate: v.sale_start_date,
                    saleEndDate: v.sale_end_date,
                    stock: v.stock,
                    imageUrl: v.image_url,
                }));
                setVariants(mappedVariants);

                // Fetch rating count
                const { data: ratingsData } = await supabase
                    .from('ratings')
                    .select('id, rating, user_id')
                    .eq('product_id', productData.id);

                setRatingCount(ratingsData?.length ?? 0);

                // Fetch initial reviews
                await fetchReviews(productData.id, 0, false);
            } catch {
                // Swallow errors — show empty state
            } finally {
                setIsLoading(false);
            }
        };

        void fetchProduct();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productUid]);

    // Fetch user's existing rating when numericId is known
    useEffect(() => {
        if (currentUserNumericId === null || product === null) return;

        const fetchUserRating = async (): Promise<void> => {
            const { data } = await supabase
                .from('ratings')
                .select('rating')
                .eq('product_id', product.id)
                .eq('user_id', currentUserNumericId)
                .maybeSingle();
            if (data) {
                setUserRating(data.rating);
            }
        };
        void fetchUserRating();
    }, [currentUserNumericId, product]);

    // ─── Log product view (debounced – 1 per user per product per hour) ────

    useEffect(() => {
        if (!product || viewLogged.current) return;

        const logView = async (): Promise<void> => {
            viewLogged.current = true;
            try {
                await supabase.from('product_views').insert({
                    product_id: product.id,
                    user_id: currentUserNumericId ?? undefined,
                });

                if (currentUserNumericId !== null) {
                    // WARNING: Typed insert - fields must match user_activity_log schema
                    await supabase.from('user_activity_log').insert({
                        user_id: currentUserNumericId,
                        activity_type: 'view',
                        product_id: product.id,
                    });
                }
            } catch {
                // Silently fail
            }
        };
        void logView();
    }, [product, currentUserNumericId]);

    // ─── Fetch reviews ─────────────────────────────────────────────────────

    const fetchReviews = useCallback(async (productId: number, offset: number, append: boolean): Promise<void> => {
        if (append) setIsLoadingMoreReviews(true);

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
                        rating: 0, // Reviews don't have embedded ratings — link via ratings table in full implementation
                        reviewText: r.review_text,
                        imageUrls: imgData?.map((i) => i.image_url) ?? [],
                        createdAt: r.created_at,
                    };
                })
            );

            if (append) {
                setReviews((prev) => [...prev, ...reviewsWithImages]);
            } else {
                setReviews(reviewsWithImages);
            }
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
            void fetchReviews(product.id, reviewOffset, true);
        }
    }, [product, isLoadingMoreReviews, hasMoreReviews, reviewOffset, fetchReviews]);

    // ─── Handlers ──────────────────────────────────────────────────────────

    const handleAddToCart = useCallback(async (quantity: number): Promise<void> => {
        if (!selectedVariant || !product || currentUserNumericId === null) return;

        setIsAddingToCart(true);
        try {
            // Check if item already in cart
            const { data: existing } = await supabase
                .from('cart_items')
                .select('id, quantity, uid')
                .eq('user_id', currentUserNumericId)
                .eq('variant_id', selectedVariant.id)
                .maybeSingle();

            if (existing) {
                // Update quantity
                const newQty = Math.min(existing.quantity + quantity, 99);
                await supabase
                    .from('cart_items')
                    .update({ quantity: newQty })
                    .eq('uid', existing.uid);
            } else {
                await supabase.from('cart_items').insert({
                    user_id: currentUserNumericId,
                    product_id: product.id,
                    variant_id: selectedVariant.id,
                    quantity,
                });
            }

            Alert.alert('✓ Added to Cart', `${product.name} (${selectedVariant.name}) × ${quantity}`);
        } catch {
            Alert.alert('Error', 'Failed to add to cart. Please try again.');
        } finally {
            setIsAddingToCart(false);
        }
    }, [selectedVariant, product, currentUserNumericId]);

    const handleRate = useCallback(async (rating: number): Promise<void> => {
        if (!product || currentUserNumericId === null) return;

        setIsRatingSubmitting(true);
        try {
            // Upsert rating
            const { data: existing } = await supabase
                .from('ratings')
                .select('uid')
                .eq('product_id', product.id)
                .eq('user_id', currentUserNumericId)
                .maybeSingle();

            if (existing) {
                await supabase.from('ratings').update({ rating }).eq('uid', existing.uid);
            } else {
                await supabase.from('ratings').insert({
                    product_id: product.id,
                    user_id: currentUserNumericId,
                    rating,
                });
                setRatingCount((prev) => prev + 1);
            }
            setUserRating(rating);
        } catch {
            Alert.alert('Error', 'Failed to submit rating. Please try again.');
        } finally {
            setIsRatingSubmitting(false);
        }
    }, [product, currentUserNumericId]);

    const handleChatWithSeller = useCallback(async (): Promise<void> => {
        if (!shop || currentUserNumericId === null || !product) return;

        setIsChatLoading(true);
        try {
            // Check for existing thread
            const { data: existing } = await supabase
                .from('chat_threads')
                .select('uid')
                .eq('buyer_id', currentUserNumericId)
                .eq('seller_id', shop.sellerId)
                .eq('shop_id', product.shopId ?? 0)
                .maybeSingle();

            if (existing) {
                router.push({ pathname: '/home/chat-thread' as string, params: { uid: existing.uid } } as Parameters<typeof router.push>[0]);
            } else {
                const { data: newThread } = await supabase
                    .from('chat_threads')
                    .insert({
                        buyer_id: currentUserNumericId,
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
    }, [shop, currentUserNumericId, product]);

    const handleWriteReview = useCallback((): void => {
        if (!product) return;
        router.push({ pathname: '/home/review-form' as string, params: { productUid: product.uid } } as Parameters<typeof router.push>[0]);
    }, [product]);

    const handleVisitShop = useCallback((): void => {
        if (!shop) return;
        router.push({ pathname: '/home/shop-landing' as string, params: { uid: shop.uid } } as Parameters<typeof router.push>[0]);
    }, [shop]);

    // ─── Determine sale info for selected variant ──────────────────────────

    const now = new Date();
    const activeSale =
        selectedVariant !== null &&
        selectedVariant.salePrice !== null &&
        selectedVariant.salePrice !== undefined &&
        selectedVariant.saleStartDate != null &&
        selectedVariant.saleEndDate != null &&
        new Date(selectedVariant.saleStartDate as string) <= now &&
        new Date(selectedVariant.saleEndDate as string) >= now;

    // ─── Render ────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SafeScreen>
                <LoadingModal isVisible message="Loading product…" />
            </SafeScreen>
        );
    }

    if (!product) {
        return (
            <SafeScreen style={styles.errorContainer}>
                <Text style={styles.errorIcon}>😕</Text>
                <Text style={styles.errorText}>Product not found</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Text style={styles.backBtnText}>Go Back</Text>
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
                    onVtonPress={() => setShowVton(true)}
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
                <View style={styles.infoSection}>
                    <Text style={styles.productName}>{product.name}</Text>

                    {/* Category & tags */}
                    <View style={styles.categoryRow}>
                        <Text style={styles.categoryChip}>
                            {product.category.charAt(0).toUpperCase() + product.category.slice(1)}
                        </Text>
                        {product.tags.slice(0, 4).map((tag, idx) => (
                            <Text key={idx} style={styles.tagChip}>{tag}</Text>
                        ))}
                    </View>

                    {/* Selected variant price */}
                    {selectedVariant && (
                        <View style={styles.priceRow}>
                            {activeSale ? (
                                <>
                                    <Text style={styles.salePriceText}>{formatPrice(selectedVariant.salePrice ?? 0)}</Text>
                                    <Text style={styles.originalPriceText}>{formatPrice(selectedVariant.price)}</Text>
                                </>
                            ) : (
                                <Text style={styles.priceText}>{formatPrice(selectedVariant.price)}</Text>
                            )}
                        </View>
                    )}

                    {/* Sale countdown */}
                    {activeSale && selectedVariant?.saleEndDate && (
                        <SaleCountdownTimer saleEndDate={selectedVariant.saleEndDate} />
                    )}

                    {/* Total sales */}
                    {product.totalSales > 0 && (
                        <Text style={styles.salesText}>🛒 {product.totalSales} sold</Text>
                    )}

                    {/* Description */}
                    <Text style={styles.descriptionLabel}>Description</Text>
                    <Text style={styles.descriptionText}>{product.description}</Text>
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
                    isLoading={isAddingToCart}
                    maxStock={selectedVariant?.stock ?? 0}
                    isDisabled={selectedVariant === null}
                />

                {/* Chat with Seller */}
                {shop && currentUserNumericId !== null && (
                    <ChatWithSellerButton onPress={handleChatWithSeller} isLoading={isChatLoading} />
                )}

                {/* Rating */}
                <InlineRatingStars
                    averageRating={product.ratingAvg ?? 0}
                    ratingCount={ratingCount}
                    userRating={userRating}
                    onRate={handleRate}
                    isSubmitting={isRatingSubmitting}
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

            {/* Virtual Try-On Modal */}
            <VirtualTryOnModal
                visible={showVton}
                onClose={() => setShowVton(false)}
                productName={product.name}
            />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    scrollContent: { paddingBottom: 48 },
    infoSection: {
        padding: 16,
        backgroundColor: lightPalette.cardBackground,
        marginBottom: 4,
    },
    productName: {
        fontSize: 22,
        fontWeight: '700',
        color: lightPalette.textPrimary,
        marginBottom: 10,
        lineHeight: 28,
    },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    categoryChip: {
        backgroundColor: 'rgba(244,67,54,0.1)',
        color: lightPalette.primary,
        fontSize: 12,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    tagChip: {
        backgroundColor: lightPalette.background,
        color: lightPalette.textSecondary,
        fontSize: 11,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: lightPalette.border,
    },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
    priceText: { fontSize: 24, fontWeight: '700', color: lightPalette.primary },
    salePriceText: { fontSize: 24, fontWeight: '700', color: lightPalette.error },
    originalPriceText: {
        fontSize: 16,
        color: lightPalette.gray,
        textDecorationLine: 'line-through',
    },
    salesText: { fontSize: 12, color: lightPalette.textSecondary, marginTop: 6 },
    descriptionLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: lightPalette.textPrimary,
        marginTop: 16,
        marginBottom: 6,
    },
    descriptionText: {
        fontSize: 14,
        color: lightPalette.textSecondary,
        lineHeight: 21,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    errorIcon: { fontSize: 48, marginBottom: 16 },
    errorText: { fontSize: 18, fontWeight: '600', color: lightPalette.textPrimary, marginBottom: 20 },
    backBtn: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: lightPalette.primary,
        borderRadius: 10,
    },
    backBtnText: { color: lightPalette.white, fontWeight: '700', fontSize: 15 },
});
