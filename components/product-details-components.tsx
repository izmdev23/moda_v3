import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { lightPalette } from '../utils/theme';
import { formatPrice } from '../utils/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewItem {
    readonly uid: string;
    readonly userName: string;
    readonly avatarUrl?: string | null;
    readonly rating: number;
    readonly reviewText: string;
    readonly imageUrls: string[];
    readonly createdAt: string;
}

export interface VariantItem {
    readonly uid: string;
    readonly id: number;
    readonly name: string;
    readonly price: number;
    readonly salePrice?: number | null;
    readonly saleStartDate?: string | null;
    readonly saleEndDate?: string | null;
    readonly stock: number;
    readonly imageUrl?: string | null;
}

// ─── ProductImageCarousel ─────────────────────────────────────────────────────

interface ProductImageCarouselProps {
    readonly imageUrls: string[];
    readonly thumbnailUrl: string;
    readonly onVtonPress: () => void;
}

/**
 * Horizontal image carousel with page indicators and virtual try-on button.
 * Supports scrollable product images with a dot page indicator.
 * @param props {ProductImageCarouselProps}
 */
export const ProductImageCarousel: React.FC<ProductImageCarouselProps> = ({
    imageUrls,
    thumbnailUrl,
    onVtonPress,
}) => {
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const images = imageUrls.length > 0 ? imageUrls : [thumbnailUrl];

    const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }): void => {
        const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActiveIndex(index);
    }, []);

    return (
        <View style={carouselStyles.container}>
            <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
            >
                {images.map((url, idx) => (
                    <Image
                        key={`img-${idx}`}
                        source={{ uri: url }}
                        style={carouselStyles.image}
                        resizeMode="cover"
                    />
                ))}
            </ScrollView>

            {/* Page indicators */}
            {images.length > 1 && (
                <View style={carouselStyles.dotsRow}>
                    {images.map((_, idx) => (
                        <View
                            key={`dot-${idx}`}
                            style={[carouselStyles.dot, activeIndex === idx && carouselStyles.dotActive]}
                        />
                    ))}
                </View>
            )}

            {/* Virtual try-on button */}
            <TouchableOpacity style={carouselStyles.vtonBtn} onPress={onVtonPress}>
                <Text style={carouselStyles.vtonText}>👗 Try On</Text>
            </TouchableOpacity>
        </View>
    );
};

const carouselStyles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
        backgroundColor: lightPalette.background,
    },
    image: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
    dotsRow: {
        position: 'absolute',
        bottom: 12,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    dotActive: { backgroundColor: lightPalette.white },
    vtonBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: lightPalette.primary,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    vtonText: { color: lightPalette.white, fontSize: 13, fontWeight: '700' },
});

// ─── ShopHeader ───────────────────────────────────────────────────────────────

interface ShopHeaderProps {
    readonly shopName: string;
    readonly city: string;
    readonly province: string;
    readonly onVisitShop: () => void;
}

/**
 * Shop info header shown at the top of a product details page.
 * @param props {ShopHeaderProps}
 */
export const ShopHeader: React.FC<ShopHeaderProps> = ({
    shopName,
    city,
    province,
    onVisitShop,
}) => {
    return (
        <View style={shopHeaderStyles.container}>
            <View style={shopHeaderStyles.info}>
                <Text style={shopHeaderStyles.name}>🏪 {shopName}</Text>
                <Text style={shopHeaderStyles.location}>
                    📍 {city}, {province}
                </Text>
            </View>
            <TouchableOpacity style={shopHeaderStyles.visitBtn} onPress={onVisitShop}>
                <Text style={shopHeaderStyles.visitText}>Visit Shop</Text>
            </TouchableOpacity>
        </View>
    );
};

const shopHeaderStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: lightPalette.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: lightPalette.border,
    },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: lightPalette.textPrimary },
    location: { fontSize: 12, color: lightPalette.textSecondary, marginTop: 2 },
    visitBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: lightPalette.primary,
    },
    visitText: { color: lightPalette.primary, fontWeight: '600', fontSize: 13 },
});

// ─── SaleCountdownTimer ────────────────────────────────────────────────────────

interface SaleCountdownTimerProps {
    readonly saleEndDate: string;
}

/**
 * Countdown timer showing time remaining on a sale.
 * @param props {SaleCountdownTimerProps}
 */
export const SaleCountdownTimer: React.FC<SaleCountdownTimerProps> = ({ saleEndDate }) => {
    const getTimeLeft = (): string => {
        const diff = new Date(saleEndDate).getTime() - Date.now();
        if (diff <= 0) return 'Sale ended';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h left`;
        }
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} left`;
    };

    const [timeLeft, setTimeLeft] = useState<string>(getTimeLeft());

    React.useEffect(() => {
        const interval = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saleEndDate]);

    return (
        <View style={timerStyles.container}>
            <Text style={timerStyles.icon}>⏰</Text>
            <Text style={timerStyles.text}>Sale ends in: {timeLeft}</Text>
        </View>
    );
};

const timerStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(244,67,54,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    icon: { fontSize: 14 },
    text: { fontSize: 12, color: lightPalette.primary, fontWeight: '700' },
});

// ─── VariantSelector ──────────────────────────────────────────────────────────

interface VariantSelectorProps {
    readonly variants: VariantItem[];
    readonly selectedUid: string | null;
    readonly onSelect: (variant: VariantItem) => void;
}

/**
 * Horizontal variant selection list.
 * Shows name, price, image thumbnail, stock status.
 * Disabled state for out-of-stock variants.
 * @param props {VariantSelectorProps}
 */
export const VariantSelector: React.FC<VariantSelectorProps> = ({
    variants,
    selectedUid,
    onSelect,
}) => {
    const now = new Date();

    const getEffectivePrice = (v: VariantItem): number => {
        if (
            v.salePrice !== null &&
            v.salePrice !== undefined &&
            v.saleStartDate &&
            v.saleEndDate &&
            new Date(v.saleStartDate) <= now &&
            new Date(v.saleEndDate) >= now
        ) {
            return v.salePrice;
        }
        return v.price;
    };

    return (
        <View style={variantStyles.container}>
            <Text style={variantStyles.label}>Select Variant</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={variantStyles.scroll}>
                {variants.map((variant) => {
                    const isOutOfStock = variant.stock === 0;
                    const isSelected = selectedUid === variant.uid;
                    const effectivePrice = getEffectivePrice(variant);
                    const onSale = effectivePrice < variant.price;

                    return (
                        <TouchableOpacity
                            key={variant.uid}
                            style={[
                                variantStyles.card,
                                isSelected && variantStyles.cardSelected,
                                isOutOfStock && variantStyles.cardDisabled,
                            ]}
                            onPress={() => !isOutOfStock && onSelect(variant)}
                            activeOpacity={isOutOfStock ? 1 : 0.7}
                            disabled={isOutOfStock}
                        >
                            {variant.imageUrl ? (
                                <Image
                                    source={{ uri: variant.imageUrl }}
                                    style={variantStyles.image}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={variantStyles.imagePlaceholder}>
                                    <Text style={variantStyles.imagePlaceholderText}>
                                        {variant.name.charAt(0)}
                                    </Text>
                                </View>
                            )}
                            <Text style={[variantStyles.variantName, isSelected && variantStyles.variantNameSelected]}>
                                {variant.name}
                            </Text>
                            <Text style={[variantStyles.price, onSale && variantStyles.priceOnSale]}>
                                {formatPrice(effectivePrice)}
                            </Text>
                            {onSale && (
                                <Text style={variantStyles.originalPrice}>{formatPrice(variant.price)}</Text>
                            )}
                            {isOutOfStock && (
                                <View style={variantStyles.outOfStockBadge}>
                                    <Text style={variantStyles.outOfStockText}>Out of Stock</Text>
                                </View>
                            )}
                            {!isOutOfStock && variant.stock <= 5 && (
                                <Text style={variantStyles.lowStockText}>Only {variant.stock} left!</Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const variantStyles = StyleSheet.create({
    container: { paddingVertical: 16 },
    label: {
        fontSize: 15,
        fontWeight: '700',
        color: lightPalette.textPrimary,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    scroll: { paddingHorizontal: 16, gap: 10 },
    card: {
        width: 110,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: lightPalette.border,
        backgroundColor: lightPalette.cardBackground,
        overflow: 'hidden',
        alignItems: 'center',
        paddingBottom: 10,
    },
    cardSelected: { borderColor: lightPalette.primary },
    cardDisabled: { opacity: 0.4 },
    image: { width: '100%', height: 80, marginBottom: 8 },
    imagePlaceholder: {
        width: '100%',
        height: 80,
        backgroundColor: lightPalette.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    imagePlaceholderText: { fontSize: 28, color: lightPalette.gray, fontWeight: '700' },
    variantName: {
        fontSize: 12,
        fontWeight: '600',
        color: lightPalette.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 6,
    },
    variantNameSelected: { color: lightPalette.primary },
    price: { fontSize: 13, fontWeight: '700', color: lightPalette.textPrimary, marginTop: 4 },
    priceOnSale: { color: lightPalette.error },
    originalPrice: {
        fontSize: 11,
        color: lightPalette.gray,
        textDecorationLine: 'line-through',
    },
    outOfStockBadge: {
        marginTop: 4,
        backgroundColor: 'rgba(0,0,0,0.08)',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    outOfStockText: { fontSize: 10, color: lightPalette.textSecondary, fontWeight: '600' },
    lowStockText: { fontSize: 10, color: lightPalette.warning, fontWeight: '700', marginTop: 4 },
});

// ─── AddToCartSection ─────────────────────────────────────────────────────────

interface AddToCartSectionProps {
    readonly onAddToCart: (quantity: number) => void;
    readonly isLoading: boolean;
    readonly maxStock: number;
    readonly isDisabled: boolean;
}

/**
 * Quantity picker and Add to Cart button for the product details page.
 * @param props {AddToCartSectionProps}
 */
export const AddToCartSection: React.FC<AddToCartSectionProps> = ({
    onAddToCart,
    isLoading,
    maxStock,
    isDisabled,
}) => {
    const [quantity, setQuantity] = useState<number>(1);

    const MAX_QTY = Math.min(99, maxStock);

    const increment = useCallback((): void => {
        setQuantity((q) => Math.min(q + 1, MAX_QTY));
    }, [MAX_QTY]);

    const decrement = useCallback((): void => {
        setQuantity((q) => Math.max(q - 1, 1));
    }, []);

    return (
        <View style={cartSectionStyles.container}>
            <View style={cartSectionStyles.qtyRow}>
                <TouchableOpacity
                    style={[cartSectionStyles.qtyBtn, quantity <= 1 && cartSectionStyles.qtyBtnDisabled]}
                    onPress={decrement}
                    disabled={quantity <= 1}
                >
                    <Text style={cartSectionStyles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={cartSectionStyles.qtyText}>{quantity}</Text>
                <TouchableOpacity
                    style={[cartSectionStyles.qtyBtn, quantity >= MAX_QTY && cartSectionStyles.qtyBtnDisabled]}
                    onPress={increment}
                    disabled={quantity >= MAX_QTY}
                >
                    <Text style={cartSectionStyles.qtyBtnText}>+</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[
                    cartSectionStyles.addBtn,
                    (isDisabled || isLoading) && cartSectionStyles.addBtnDisabled,
                ]}
                onPress={() => onAddToCart(quantity)}
                disabled={isDisabled || isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={lightPalette.white} />
                ) : (
                    <Text style={cartSectionStyles.addBtnText}>
                        {isDisabled ? '⚠️ Select a Variant' : '🛒 Add to Cart'}
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

const cartSectionStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        gap: 12,
    },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        alignSelf: 'flex-start',
    },
    qtyBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: lightPalette.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: lightPalette.cardBackground,
    },
    qtyBtnDisabled: { opacity: 0.4 },
    qtyBtnText: { fontSize: 22, color: lightPalette.textPrimary, fontWeight: '600', lineHeight: 24 },
    qtyText: { fontSize: 17, fontWeight: '700', color: lightPalette.textPrimary, minWidth: 30, textAlign: 'center' },
    addBtn: {
        backgroundColor: lightPalette.primary,
        paddingVertical: 15,
        borderRadius: 14,
        alignItems: 'center',
    },
    addBtnDisabled: { backgroundColor: lightPalette.gray },
    addBtnText: { color: lightPalette.white, fontSize: 16, fontWeight: '700' },
});

// ─── InlineRatingStars ────────────────────────────────────────────────────────

interface InlineRatingStarsProps {
    readonly averageRating: number;
    readonly ratingCount: number;
    readonly userRating: number | null;
    readonly onRate: (rating: number) => void;
    readonly isSubmitting: boolean;
}

/**
 * Star rating display and quick-tap rating input for product details.
 * Shows average + count and allows user to tap 1-5 stars.
 * @param props {InlineRatingStarsProps}
 */
export const InlineRatingStars: React.FC<InlineRatingStarsProps> = ({
    averageRating,
    ratingCount,
    userRating,
    onRate,
    isSubmitting,
}) => {
    const [hoveredStar, setHoveredStar] = useState<number | null>(null);
    const displayRating = userRating ?? hoveredStar ?? 0;

    return (
        <View style={starsStyles.container}>
            <View style={starsStyles.summaryRow}>
                <Text style={starsStyles.avgText}>{averageRating.toFixed(1)}</Text>
                <Text style={starsStyles.starIcon}>★</Text>
                <Text style={starsStyles.countText}>({ratingCount} ratings)</Text>
            </View>
            <View style={starsStyles.inputRow}>
                <Text style={starsStyles.tapLabel}>Your rating: </Text>
                <View style={starsStyles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                            key={star}
                            onPress={() => !isSubmitting && onRate(star)}
                            disabled={isSubmitting}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Text
                                style={[
                                    starsStyles.star,
                                    star <= displayRating && starsStyles.starFilled,
                                ]}
                            >
                                ★
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {isSubmitting && <ActivityIndicator size="small" color={lightPalette.primary} style={{ marginLeft: 8 }} />}
            </View>
            {userRating !== null && (
                <Text style={starsStyles.thankYou}>✓ You rated this {userRating} star{userRating !== 1 ? 's' : ''}</Text>
            )}
        </View>
    );
};

const starsStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: lightPalette.cardBackground,
        marginBottom: 1,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
    avgText: { fontSize: 28, fontWeight: '700', color: lightPalette.textPrimary },
    starIcon: { fontSize: 24, color: '#FFCC00' },
    countText: { fontSize: 14, color: lightPalette.textSecondary },
    inputRow: { flexDirection: 'row', alignItems: 'center' },
    tapLabel: { fontSize: 14, color: lightPalette.textSecondary },
    starsRow: { flexDirection: 'row', gap: 4 },
    star: { fontSize: 28, color: lightPalette.border },
    starFilled: { color: '#FFCC00' },
    thankYou: { fontSize: 12, color: lightPalette.success, marginTop: 6, fontWeight: '600' },
});

// ─── ReviewCard ───────────────────────────────────────────────────────────────

interface ReviewCardProps {
    readonly review: ReviewItem;
}

/**
 * Individual review card showing avatar, name, stars, text, and images.
 * @param props {ReviewCardProps}
 */
export const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
    const dateStr = new Date(review.createdAt).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    return (
        <View style={reviewCardStyles.container}>
            <View style={reviewCardStyles.header}>
                <View style={reviewCardStyles.avatar}>
                    {review.avatarUrl ? (
                        <Image source={{ uri: review.avatarUrl }} style={reviewCardStyles.avatarImg} />
                    ) : (
                        <View style={reviewCardStyles.avatarFallback}>
                            <Text style={reviewCardStyles.avatarFallbackText}>
                                {review.userName.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={reviewCardStyles.meta}>
                    <Text style={reviewCardStyles.name}>{review.userName}</Text>
                    <View style={reviewCardStyles.starsRow}>
                        {[1, 2, 3, 4, 5].map((s) => (
                            <Text key={s} style={[reviewCardStyles.star, s <= review.rating && reviewCardStyles.starFilled]}>★</Text>
                        ))}
                        <Text style={reviewCardStyles.date}> · {dateStr}</Text>
                    </View>
                </View>
            </View>
            <Text style={reviewCardStyles.text}>{review.reviewText}</Text>
            {review.imageUrls.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={reviewCardStyles.imagesScroll}>
                    {review.imageUrls.map((url, idx) => (
                        <Image
                            key={idx}
                            source={{ uri: url }}
                            style={reviewCardStyles.reviewImage}
                            resizeMode="cover"
                        />
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

const reviewCardStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: lightPalette.border,
        backgroundColor: lightPalette.cardBackground,
    },
    header: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    avatar: { width: 40, height: 40 },
    avatarImg: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: lightPalette.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarFallbackText: { color: lightPalette.white, fontSize: 16, fontWeight: '700' },
    meta: { flex: 1, justifyContent: 'center' },
    name: { fontSize: 14, fontWeight: '700', color: lightPalette.textPrimary },
    starsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    star: { fontSize: 13, color: lightPalette.border },
    starFilled: { color: '#FFCC00' },
    date: { fontSize: 11, color: lightPalette.textSecondary },
    text: { fontSize: 14, color: lightPalette.textPrimary, lineHeight: 20 },
    imagesScroll: { marginTop: 10 },
    reviewImage: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
});

// ─── ReviewsList ──────────────────────────────────────────────────────────────

interface ReviewsListProps {
    readonly reviews: ReviewItem[];
    readonly isLoading: boolean;
    readonly onLoadMore: () => void;
    readonly hasMore: boolean;
    readonly onWriteReview: () => void;
}

/**
 * Paginated reviews list below the rating section.
 * @param props {ReviewsListProps}
 */
export const ReviewsList: React.FC<ReviewsListProps> = ({
    reviews,
    isLoading,
    onLoadMore,
    hasMore,
    onWriteReview,
}) => {
    return (
        <View style={reviewsListStyles.container}>
            <View style={reviewsListStyles.header}>
                <Text style={reviewsListStyles.title}>Reviews</Text>
                <TouchableOpacity style={reviewsListStyles.writeBtn} onPress={onWriteReview}>
                    <Text style={reviewsListStyles.writeBtnText}>✏️ Write a Review</Text>
                </TouchableOpacity>
            </View>
            {reviews.map((r) => (
                <ReviewCard key={r.uid} review={r} />
            ))}
            {isLoading && (
                <View style={reviewsListStyles.loading}>
                    <ActivityIndicator size="small" color={lightPalette.primary} />
                </View>
            )}
            {!isLoading && hasMore && (
                <TouchableOpacity style={reviewsListStyles.loadMoreBtn} onPress={onLoadMore}>
                    <Text style={reviewsListStyles.loadMoreText}>Load More Reviews</Text>
                </TouchableOpacity>
            )}
            {!isLoading && reviews.length === 0 && (
                <View style={reviewsListStyles.empty}>
                    <Text style={reviewsListStyles.emptyIcon}>💬</Text>
                    <Text style={reviewsListStyles.emptyText}>No reviews yet. Be the first!</Text>
                </View>
            )}
        </View>
    );
};

const reviewsListStyles = StyleSheet.create({
    container: { backgroundColor: lightPalette.cardBackground },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: lightPalette.border,
    },
    title: { fontSize: 17, fontWeight: '700', color: lightPalette.textPrimary },
    writeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(244,67,54,0.1)',
    },
    writeBtnText: { color: lightPalette.primary, fontSize: 13, fontWeight: '700' },
    loading: { paddingVertical: 16, alignItems: 'center' },
    loadMoreBtn: { alignItems: 'center', padding: 16 },
    loadMoreText: { color: lightPalette.primary, fontWeight: '600', fontSize: 14 },
    empty: { padding: 32, alignItems: 'center', gap: 8 },
    emptyIcon: { fontSize: 32 },
    emptyText: { color: lightPalette.textSecondary, fontSize: 14 },
});

// ─── ChatWithSellerButton ─────────────────────────────────────────────────────

interface ChatWithSellerButtonProps {
    readonly onPress: () => void;
    readonly isLoading: boolean;
}

/**
 * Chat with seller CTA button for buyers on the product details page.
 * @param props {ChatWithSellerButtonProps}
 */
export const ChatWithSellerButton: React.FC<ChatWithSellerButtonProps> = ({
    onPress,
    isLoading,
}) => {
    return (
        <TouchableOpacity
            style={chatBtnStyles.container}
            onPress={onPress}
            disabled={isLoading}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color={lightPalette.primary} />
            ) : (
                <>
                    <Text style={chatBtnStyles.icon}>💬</Text>
                    <Text style={chatBtnStyles.text}>Chat with Seller</Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const chatBtnStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: lightPalette.primary,
        marginHorizontal: 16,
        marginBottom: 16,
    },
    icon: { fontSize: 18 },
    text: { color: lightPalette.primary, fontSize: 15, fontWeight: '700' },
});

// ─── VirtualTryOnModal ────────────────────────────────────────────────────────

interface VirtualTryOnModalProps {
    readonly visible: boolean;
    readonly onClose: () => void;
    readonly productName: string;
}

/**
 * Placeholder Virtual try-on modal — Phase 19 will implement the full flow.
 * @param props {VirtualTryOnModalProps}
 */
export const VirtualTryOnModal: React.FC<VirtualTryOnModalProps> = ({
    visible,
    onClose,
    productName,
}) => {
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={vtonStyles.overlay}>
                <Animated.View entering={FadeIn} exiting={FadeOut} style={vtonStyles.panel}>
                    <TouchableOpacity style={vtonStyles.closeBtn} onPress={onClose}>
                        <Text style={vtonStyles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={vtonStyles.emoji}>👗</Text>
                    <Text style={vtonStyles.title}>Virtual Try-On</Text>
                    <Text style={vtonStyles.subtitle}>Try on "{productName}"</Text>
                    <Text style={vtonStyles.comingSoon}>
                        Upload a photo of yourself to see how this item looks on you.
                    </Text>
                    <Text style={vtonStyles.note}>
                        Full virtual try-on will be available in Phase 19.
                    </Text>
                    <TouchableOpacity style={vtonStyles.closeActionBtn} onPress={onClose}>
                        <Text style={vtonStyles.closeActionText}>Close</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const vtonStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    panel: {
        backgroundColor: lightPalette.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 32,
        alignItems: 'center',
        paddingBottom: 48,
    },
    closeBtn: { position: 'absolute', top: 16, right: 20 },
    closeBtnText: { fontSize: 20, color: lightPalette.gray },
    emoji: { fontSize: 48, marginBottom: 16 },
    title: { fontSize: 22, fontWeight: '700', color: lightPalette.textPrimary, marginBottom: 6 },
    subtitle: { fontSize: 14, color: lightPalette.textSecondary, marginBottom: 16, textAlign: 'center' },
    comingSoon: {
        fontSize: 14,
        color: lightPalette.textPrimary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 8,
    },
    note: { fontSize: 12, color: lightPalette.gray, textAlign: 'center', fontStyle: 'italic', marginBottom: 24 },
    closeActionBtn: {
        paddingHorizontal: 32,
        paddingVertical: 12,
        backgroundColor: lightPalette.primary,
        borderRadius: 12,
    },
    closeActionText: { color: lightPalette.white, fontWeight: '700', fontSize: 15 },
});
