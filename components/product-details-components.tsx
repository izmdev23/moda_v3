import { RipplePressable } from '@/components/ui/ripple-pressable';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatPrice } from '../utils/utils';
import { useTheme } from './ui/theme-provider';

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
    readonly extractedOutfitUrl?: string | null;
    readonly isFullBody?: boolean;
}

// ─── ProductImageCarousel ─────────────────────────────────────────────────────

interface ProductImageCarouselProps {
    readonly imageUrls: string[];
    readonly thumbnailUrl: string;
    readonly onVtonPress?: () => void;
    readonly showVton: boolean;
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
    showVton,
}) => {
    const { theme } = useTheme();
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [isFullscreenVisible, setIsFullscreenVisible] = useState<boolean>(false);
    const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
    const images = imageUrls.length > 0 ? imageUrls : [thumbnailUrl];

    const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }): void => {
        const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActiveIndex(index);
    }, []);

    const handleOpenFullscreen = useCallback((url: string): void => {
        setFullscreenImageUrl(url);
        setIsFullscreenVisible(true);
    }, []);

    const handleCloseFullscreen = useCallback((): void => {
        setIsFullscreenVisible(false);
        setFullscreenImageUrl(null);
    }, []);

    return (
        <View style={[carouselStyles.container, { backgroundColor: theme.background }]}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={handleScroll}>
                {images.map((url, idx) => (
                    <RipplePressable
                        key={`img-${idx}`}
                        onPress={() => handleOpenFullscreen(url)}
                        activeOpacity={0.98}
                    >
                        <Image source={{ uri: url }} style={carouselStyles.image} resizeMode="cover" />
                    </RipplePressable>
                ))}
            </ScrollView>
            {images.length > 1 && (
                <View style={carouselStyles.dotsRow}>
                    {images.map((_, idx) => (
                        <View key={`dot-${idx}`} style={[carouselStyles.dot, activeIndex === idx && { backgroundColor: theme.white }]} />
                    ))}
                </View>
            )}
            {showVton && typeof onVtonPress === 'function' && (
                <RipplePressable style={[carouselStyles.vtonBtn, { backgroundColor: theme.primary }]} onPress={onVtonPress}>
                    <Text style={[carouselStyles.vtonText, { color: theme.white }]}>👗 Try On</Text>
                </RipplePressable>
            )}

            <Modal
                visible={isFullscreenVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={handleCloseFullscreen}
            >
                <View style={carouselStyles.modalBg}>
                    {fullscreenImageUrl !== null && (
                        <Image
                            source={{ uri: fullscreenImageUrl }}
                            style={carouselStyles.modalImage}
                            resizeMode="contain"
                        />
                    )}
                    <RipplePressable
                        style={carouselStyles.modalClose}
                        onPress={handleCloseFullscreen}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Text style={carouselStyles.modalCloseText}>✕</Text>
                    </RipplePressable>
                </View>
            </Modal>
        </View>
    );
};

const carouselStyles = StyleSheet.create({
    container: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
    image: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
    dotsRow: { position: 'absolute', bottom: 12, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.5)' },
    vtonBtn: {
        position: 'absolute', top: 12, right: 12,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
    },
    vtonText: { fontSize: 13, fontWeight: '700' },
    modalBg: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalImage: {
        width: '100%',
        height: '100%',
    },
    modalClose: {
        position: 'absolute',
        top: 48,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
});

// ─── ShopHeader ───────────────────────────────────────────────────────────────

interface ShopHeaderProps {
    readonly shopName: string;
    readonly city: string;
    readonly province: string;
    readonly onVisitShop: () => void;
    readonly isVisitDisabled?: boolean;
}

/**
 * Shop info header shown at the top of a product details page.
 * @param props {ShopHeaderProps}
 */
export const ShopHeader: React.FC<ShopHeaderProps> = ({ shopName, city, province, onVisitShop, isVisitDisabled = false }) => {
    const { theme } = useTheme();
    return (
        <View style={[shopHeaderStyles.container, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
            <View style={shopHeaderStyles.info}>
                <Text style={[shopHeaderStyles.name, { color: theme.textPrimary }]}>🏪 {shopName}</Text>
                <Text style={[shopHeaderStyles.location, { color: theme.textSecondary }]}>📍 {city}, {province}</Text>
            </View>
            <RipplePressable
                style={[
                    shopHeaderStyles.visitBtn,
                    {
                        borderColor: isVisitDisabled ? theme.border : theme.primary,
                        backgroundColor: isVisitDisabled ? theme.background : theme.cardBackground,
                    },
                    isVisitDisabled && shopHeaderStyles.visitBtnDisabled,
                ]}
                onPress={onVisitShop}
                disabled={isVisitDisabled}
            >
                <Text style={[shopHeaderStyles.visitText, { color: isVisitDisabled ? theme.textSecondary : theme.primary }]}>Visit Shop</Text>
            </RipplePressable>
        </View>
    );
};

const shopHeaderStyles = StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700' },
    location: { fontSize: 12, marginTop: 2 },
    visitBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    visitBtnDisabled: { opacity: 0.6 },
    visitText: { fontWeight: '600', fontSize: 13 },
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
        return (): void => {
            clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saleEndDate]);

    const { theme } = useTheme();
    return (
        <View style={[timerStyles.container, { backgroundColor: `${theme.primary}1A` }]}>
            <Text style={timerStyles.icon}>⏰</Text>
            <Text style={[timerStyles.text, { color: theme.primary }]}>Sale ends in: {timeLeft}</Text>
        </View>
    );
};

const timerStyles = StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8 },
    icon: { fontSize: 14 },
    text: { fontSize: 12, fontWeight: '700' },
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
export const VariantSelector: React.FC<VariantSelectorProps> = ({ variants, selectedUid, onSelect }) => {
    const { theme } = useTheme();
    const now = new Date();

    const getEffectivePrice = (v: VariantItem): number => {
        if (v.salePrice !== null && v.salePrice !== undefined && v.saleStartDate && v.saleEndDate &&
            new Date(v.saleStartDate) <= now && new Date(v.saleEndDate) >= now) {
            return v.salePrice;
        }
        return v.price;
    };

    return (
        <View style={variantStyles.container}>
            <Text style={[variantStyles.label, { color: theme.textPrimary }]}>Select Variant</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={variantStyles.scroll}>
                {variants.map((variant) => {
                    const isOutOfStock = variant.stock === 0;
                    const isSelected = selectedUid === variant.uid;
                    const effectivePrice = getEffectivePrice(variant);
                    const onSale = effectivePrice < variant.price;
                    const previewImageUrl = variant.extractedOutfitUrl ?? variant.imageUrl;
                    return (
                        <RipplePressable
                            key={variant.uid}
                            style={[
                                variantStyles.card,
                                { borderColor: theme.border, backgroundColor: theme.cardBackground },
                                isSelected && { borderColor: theme.primary },
                                isOutOfStock && variantStyles.cardDisabled,
                            ]}
                            onPress={() => !isOutOfStock && onSelect(variant)}
                            activeOpacity={isOutOfStock ? 1 : 0.7}
                            disabled={isOutOfStock}
                        >
                            {previewImageUrl ? (
                                <Image source={{ uri: previewImageUrl }} style={variantStyles.image} resizeMode="cover" />
                            ) : (
                                <View style={[variantStyles.imagePlaceholder, { backgroundColor: theme.background }]}>
                                    <Text style={[variantStyles.imagePlaceholderText, { color: theme.gray }]}>
                                        {variant.name.charAt(0)}
                                    </Text>
                                </View>
                            )}
                            <Text style={[variantStyles.variantName, { color: isSelected ? theme.primary : theme.textSecondary }]}>
                                {variant.name}
                            </Text>
                            <Text style={[variantStyles.price, { color: onSale ? theme.error : theme.textPrimary }]}>
                                {formatPrice(effectivePrice)}
                            </Text>
                            {onSale && (
                                <Text style={[variantStyles.originalPrice, { color: theme.gray }]}>{formatPrice(variant.price)}</Text>
                            )}
                            {isOutOfStock && (
                                <View style={variantStyles.outOfStockBadge}>
                                    <Text style={[variantStyles.outOfStockText, { color: theme.textSecondary }]}>Sold Out</Text>
                                </View>
                            )}
                            {!isOutOfStock && variant.stock <= 5 && (
                                <Text style={[variantStyles.lowStockText, { color: theme.warning }]}>Low Stock • {variant.stock} left</Text>
                            )}
                            {!isOutOfStock && variant.stock > 5 && (
                                <Text style={[variantStyles.inStockText, { color: theme.success }]}>In Stock • {variant.stock} left</Text>
                            )}
                        </RipplePressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const variantStyles = StyleSheet.create({
    container: { paddingVertical: 16 },
    label: { fontSize: 15, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 },
    scroll: { paddingHorizontal: 16, gap: 10 },
    card: { width: 110, borderRadius: 12, borderWidth: 1.5, overflow: 'hidden', alignItems: 'center', paddingBottom: 10 },
    cardDisabled: { opacity: 0.4 },
    image: { width: '100%', height: 80, marginBottom: 8 },
    imagePlaceholder: { width: '100%', height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    imagePlaceholderText: { fontSize: 28, fontWeight: '700' },
    variantName: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 6 },
    price: { fontSize: 13, fontWeight: '700', marginTop: 4 },
    originalPrice: { fontSize: 11, textDecorationLine: 'line-through' },
    outOfStockBadge: { marginTop: 4, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    outOfStockText: { fontSize: 10, fontWeight: '600' },
    lowStockText: { fontSize: 10, fontWeight: '700', marginTop: 4 },
    inStockText: { fontSize: 10, fontWeight: '700', marginTop: 4 },
});

// ─── AddToCartSection ─────────────────────────────────────────────────────────

interface AddToCartSectionProps {
    readonly onAddToCart: (quantity: number) => void;
    readonly isLoading: boolean;
    readonly maxStock: number;
    readonly isDisabled: boolean;
    readonly disabledLabel?: string;
}

/**
 * Quantity picker and Add to Cart button for the product details page.
 * @param props {AddToCartSectionProps}
 */
export const AddToCartSection: React.FC<AddToCartSectionProps> = ({
    onAddToCart, isLoading, maxStock, isDisabled, disabledLabel,
}) => {
    const { theme } = useTheme();
    const [quantity, setQuantity] = useState<number>(1);
    const MAX_QTY = Math.min(99, maxStock);
    const increment = useCallback((): void => { setQuantity((q) => Math.min(q + 1, MAX_QTY)); }, [MAX_QTY]);
    const decrement = useCallback((): void => { setQuantity((q) => Math.max(q - 1, 1)); }, []);

    return (
        <View style={cartSectionStyles.container}>
            <View style={cartSectionStyles.qtyRow}>
                <RipplePressable
                    style={[
                        cartSectionStyles.qtyBtn,
                        { borderColor: theme.border, backgroundColor: theme.cardBackground },
                        (quantity <= 1 || isDisabled) && cartSectionStyles.qtyBtnDisabled,
                    ]}
                    onPress={decrement}
                    disabled={quantity <= 1 || isDisabled}
                >
                    <Text style={[cartSectionStyles.qtyBtnText, { color: theme.textPrimary }]}>−</Text>
                </RipplePressable>
                <Text style={[cartSectionStyles.qtyText, { color: theme.textPrimary }]}>{quantity}</Text>
                <RipplePressable
                    style={[
                        cartSectionStyles.qtyBtn,
                        { borderColor: theme.border, backgroundColor: theme.cardBackground },
                        (quantity >= MAX_QTY || isDisabled) && cartSectionStyles.qtyBtnDisabled,
                    ]}
                    onPress={increment}
                    disabled={quantity >= MAX_QTY || isDisabled}
                >
                    <Text style={[cartSectionStyles.qtyBtnText, { color: theme.textPrimary }]}>+</Text>
                </RipplePressable>
            </View>
            <RipplePressable
                style={[cartSectionStyles.addBtn, { backgroundColor: isDisabled || isLoading ? theme.gray : theme.primary }, (isDisabled || isLoading) && cartSectionStyles.addBtnDisabled]}
                onPress={() => onAddToCart(quantity)}
                disabled={isDisabled || isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={theme.white} />
                ) : (
                    <Text style={[cartSectionStyles.addBtnText, { color: theme.white }]}>
                        {isDisabled ? (disabledLabel ?? 'Select a Variant') : 'Add to Cart'}
                    </Text>
                )}
            </RipplePressable>
        </View>
    );
};

const cartSectionStyles = StyleSheet.create({
    container: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
    qtyBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
    qtyBtnDisabled: { opacity: 0.4 },
    qtyBtnText: { fontSize: 22, fontWeight: '600', lineHeight: 24 },
    qtyText: { fontSize: 17, fontWeight: '700', minWidth: 30, textAlign: 'center' },
    addBtn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
    addBtnDisabled: { opacity: 0.6 },
    addBtnText: { fontSize: 16, fontWeight: '700' },
});

// ─── InlineRatingStars ────────────────────────────────────────────────────────

interface InlineRatingStarsProps {
    readonly averageRating: number;
    readonly ratingCount: number;
    readonly userRating: number | null;
    readonly onRate: (rating: number) => void;
    readonly isSubmitting: boolean;
    readonly isReadOnly?: boolean;
}

/**
 * Star rating display and quick-tap rating input for product details.
 * Shows average + count and allows user to tap 1-5 stars.
 * @param props {InlineRatingStarsProps}
 */
export const InlineRatingStars: React.FC<InlineRatingStarsProps> = ({
    averageRating, ratingCount, userRating, onRate, isSubmitting, isReadOnly = false,
}) => {
    const { theme } = useTheme();
    const [hoveredStar, setHoveredStar] = useState<number | null>(null);
    const displayRating = userRating ?? hoveredStar ?? 0;

    return (
        <View style={[starsStyles.container, { backgroundColor: theme.cardBackground }]}>
            <View style={starsStyles.summaryRow}>
                <Text style={[starsStyles.avgText, { color: theme.textPrimary }]}>{averageRating.toFixed(1)}</Text>
                <Text style={starsStyles.starIcon}>★</Text>
                <Text style={[starsStyles.countText, { color: theme.textSecondary }]}>({ratingCount} ratings)</Text>
            </View>
            <View style={starsStyles.inputRow}>
                <Text style={[starsStyles.tapLabel, { color: theme.textSecondary }]}>Your rating: </Text>
                <View style={starsStyles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <RipplePressable
                            key={star}
                            onPress={() => !isSubmitting && !isReadOnly && onRate(star)}
                            disabled={isSubmitting || isReadOnly}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Text style={[starsStyles.star, { color: star <= displayRating ? theme.starColor : theme.border }]}>★</Text>
                        </RipplePressable>
                    ))}
                </View>
                {isSubmitting && <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: 8 }} />}
            </View>
            {isReadOnly && (
                <Text style={[starsStyles.readOnlyText, { color: theme.textSecondary }]}>Seller read-only mode</Text>
            )}
            {userRating !== null && (
                <Text style={[starsStyles.thankYou, { color: theme.success }]}>✓ You rated this {userRating} star{userRating !== 1 ? 's' : ''}</Text>
            )}
        </View>
    );
};

const starsStyles = StyleSheet.create({
    container: { paddingHorizontal: 16, paddingVertical: 16, marginBottom: 1 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
    avgText: { fontSize: 28, fontWeight: '700' },
    starIcon: { fontSize: 24, color: '#FFCC00' },
    countText: { fontSize: 14 },
    inputRow: { flexDirection: 'row', alignItems: 'center' },
    tapLabel: { fontSize: 14 },
    starsRow: { flexDirection: 'row', gap: 4 },
    star: { fontSize: 28 },
    readOnlyText: { fontSize: 12, marginTop: 6 },
    thankYou: { fontSize: 12, marginTop: 6, fontWeight: '600' },
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
    const { theme } = useTheme();
    const dateStr = new Date(review.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    return (
        <View style={[reviewCardStyles.container, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
            <View style={reviewCardStyles.header}>
                <View style={reviewCardStyles.avatar}>
                    {review.avatarUrl ? (
                        <Image source={{ uri: review.avatarUrl }} style={reviewCardStyles.avatarImg} />
                    ) : (
                        <View style={[reviewCardStyles.avatarFallback, { backgroundColor: theme.primary }]}>
                            <Text style={[reviewCardStyles.avatarFallbackText, { color: theme.white }]}>{review.userName.charAt(0).toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                <View style={reviewCardStyles.meta}>
                    <Text style={[reviewCardStyles.name, { color: theme.textPrimary }]}>{review.userName}</Text>
                    <View style={reviewCardStyles.starsRow}>
                        {[1, 2, 3, 4, 5].map((s) => (
                            <Text key={s} style={[reviewCardStyles.star, { color: s <= review.rating ? theme.starColor : theme.border }]}>★</Text>
                        ))}
                        <Text style={[reviewCardStyles.date, { color: theme.textSecondary }]}> · {dateStr}</Text>
                    </View>
                </View>
            </View>
            <Text style={[reviewCardStyles.text, { color: theme.textPrimary }]}>{review.reviewText}</Text>
            {review.imageUrls.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={reviewCardStyles.imagesScroll}>
                    {review.imageUrls.map((url, idx) => (
                        <Image key={idx} source={{ uri: url }} style={reviewCardStyles.reviewImage} resizeMode="cover" />
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

const reviewCardStyles = StyleSheet.create({
    container: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
    header: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    avatar: { width: 40, height: 40 },
    avatarImg: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    avatarFallbackText: { fontSize: 16, fontWeight: '700' },
    meta: { flex: 1, justifyContent: 'center' },
    name: { fontSize: 14, fontWeight: '700' },
    starsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    star: { fontSize: 13 },
    date: { fontSize: 11 },
    text: { fontSize: 14, lineHeight: 20 },
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
    readonly reviewButtonLabel?: string;
    readonly isReadOnly?: boolean;
}

/**
 * Paginated reviews list below the rating section.
 * @param props {ReviewsListProps}
 */
export const ReviewsList: React.FC<ReviewsListProps> = ({ reviews, isLoading, onLoadMore, hasMore, onWriteReview, reviewButtonLabel = 'Write a Review', isReadOnly = false }) => {
    const { theme } = useTheme();
    return (
        <View style={[reviewsListStyles.container, { backgroundColor: theme.cardBackground }]}>
            <View style={[reviewsListStyles.header, { borderBottomColor: theme.border }]}>
                <Text style={[reviewsListStyles.title, { color: theme.textPrimary }]}>Reviews</Text>
                <RipplePressable
                    style={[
                        reviewsListStyles.writeBtn,
                        {
                            backgroundColor: isReadOnly ? theme.background : `${theme.primary}1A`,
                        },
                        isReadOnly && reviewsListStyles.writeBtnDisabled,
                    ]}
                    onPress={onWriteReview}
                    disabled={isReadOnly}
                >
                    <Text style={[reviewsListStyles.writeBtnText, { color: isReadOnly ? theme.textSecondary : theme.primary }]}>{reviewButtonLabel}</Text>
                </RipplePressable>
            </View>
            {reviews.map((r) => (<ReviewCard key={r.uid} review={r} />))}
            {isLoading && (
                <View style={reviewsListStyles.loading}>
                    <ActivityIndicator size="small" color={theme.primary} />
                </View>
            )}
            {!isLoading && hasMore && (
                <RipplePressable style={reviewsListStyles.loadMoreBtn} onPress={onLoadMore}>
                    <Text style={[reviewsListStyles.loadMoreText, { color: theme.primary }]}>Load More Reviews</Text>
                </RipplePressable>
            )}
            {!isLoading && reviews.length === 0 && (
                <View style={reviewsListStyles.empty}>
                    <Text style={reviewsListStyles.emptyIcon}>💬</Text>
                    <Text style={[reviewsListStyles.emptyText, { color: theme.textSecondary }]}>No reviews yet. Be the first!</Text>
                </View>
            )}
        </View>
    );
};

const reviewsListStyles = StyleSheet.create({
    container: {},
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
    title: { fontSize: 17, fontWeight: '700' },
    writeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    writeBtnDisabled: { opacity: 0.6 },
    writeBtnText: { fontSize: 13, fontWeight: '700' },
    loading: { paddingVertical: 16, alignItems: 'center' },
    loadMoreBtn: { alignItems: 'center', padding: 16 },
    loadMoreText: { fontWeight: '600', fontSize: 14 },
    empty: { padding: 32, alignItems: 'center', gap: 8 },
    emptyIcon: { fontSize: 32 },
    emptyText: { fontSize: 14 },
});

// ─── ChatWithSellerButton ─────────────────────────────────────────────────────

interface ChatWithSellerButtonProps {
    readonly onPress: () => void;
    readonly isLoading: boolean;
    readonly isDisabled?: boolean;
}

/**
 * Chat with seller CTA button for buyers on the product details page.
 * @param props {ChatWithSellerButtonProps}
 */
export const ChatWithSellerButton: React.FC<ChatWithSellerButtonProps> = ({ onPress, isLoading, isDisabled = false }) => {
    const { theme } = useTheme();
    return (
        <RipplePressable
            style={[
                chatBtnStyles.container,
                {
                    borderColor: isDisabled ? theme.border : theme.primary,
                    backgroundColor: isDisabled ? theme.background : theme.cardBackground,
                },
                isDisabled && chatBtnStyles.disabled,
            ]}
            onPress={onPress}
            disabled={isLoading || isDisabled}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
            ) : (
                <>
                    <Text style={chatBtnStyles.icon}>💬</Text>
                    <Text style={[chatBtnStyles.text, { color: isDisabled ? theme.textSecondary : theme.primary }]}>Chat with Seller</Text>
                </>
            )}
        </RipplePressable>
    );
};

const chatBtnStyles = StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, marginHorizontal: 16, marginBottom: 16 },
    disabled: { opacity: 0.6 },
    icon: { fontSize: 18 },
    text: { fontSize: 15, fontWeight: '700' },
});

// ─── VirtualTryOnModal ────────────────────────────────────────────────────────

// NOTE: The full virtual try-on modal is implemented in virtual-tryon-components.tsx
// as TryOnModal. The placeholder below was removed in Phase 19.
// Import TryOnModal directly from '../components/virtual-tryon-components' instead.
