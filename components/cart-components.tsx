import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    PanResponder,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { lightPalette } from '../utils/theme';
import { formatPrice } from '../utils/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItemData {
    readonly uid: string;
    readonly productUid: string;
    readonly productName: string;
    readonly variantName: string;
    readonly price: number;
    readonly thumbnailUrl: string;
    readonly quantity: number;
    readonly stock: number;
    readonly isAvailable: boolean;
    /** True when price changed since being added to cart */
    readonly hasPriceChanged: boolean;
}

// ─── CartWarningBanner ────────────────────────────────────────────────────────

interface CartWarningBannerProps {
    readonly message: string;
}

/**
 * Warning banner shown at the top of the cart for stock/availability issues.
 * @param props {CartWarningBannerProps}
 */
export const CartWarningBanner: React.FC<CartWarningBannerProps> = ({ message }) => {
    return (
        <View style={bannerStyles.container}>
            <Text style={bannerStyles.icon}>⚠️</Text>
            <Text style={bannerStyles.text}>{message}</Text>
        </View>
    );
};

const bannerStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(251,99,64,0.1)',
        borderLeftWidth: 4,
        borderLeftColor: lightPalette.warning,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 8,
    },
    icon: { fontSize: 16 },
    text: { flex: 1, fontSize: 13, color: lightPalette.textPrimary, lineHeight: 18 },
});

// ─── QuantityControl ──────────────────────────────────────────────────────────

interface QuantityControlProps {
    readonly quantity: number;
    readonly maxStock: number;
    readonly onIncrement: () => void;
    readonly onDecrement: () => void;
    readonly onManualInput: (qty: number) => void;
    readonly isLoading: boolean;
}

const MAX_CART_QTY = 99;

/**
 * +/- quantity control with tappable numeric input for manual entry.
 * @param props {QuantityControlProps}
 */
export const QuantityControl: React.FC<QuantityControlProps> = ({
    quantity,
    maxStock,
    onIncrement,
    onDecrement,
    onManualInput,
    isLoading,
}) => {
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [inputText, setInputText] = useState<string>(String(quantity));

    const maxQty = Math.min(MAX_CART_QTY, maxStock);

    const handleTextPress = useCallback((): void => {
        setIsEditing(true);
        setInputText(String(quantity));
    }, [quantity]);

    const handleBlur = useCallback((): void => {
        setIsEditing(false);
        const parsed = parseInt(inputText, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= maxQty) {
            onManualInput(parsed);
        }
    }, [inputText, maxQty, onManualInput]);

    return (
        <View style={qtyStyles.container}>
            <TouchableOpacity
                style={[qtyStyles.btn, (quantity <= 1 || isLoading) && qtyStyles.btnDisabled]}
                onPress={onDecrement}
                disabled={quantity <= 1 || isLoading}
            >
                <Text style={qtyStyles.btnText}>−</Text>
            </TouchableOpacity>

            {isEditing ? (
                <TextInput
                    style={qtyStyles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    keyboardType="numeric"
                    onBlur={handleBlur}
                    autoFocus
                    selectTextOnFocus
                    maxLength={2}
                />
            ) : (
                <TouchableOpacity onPress={handleTextPress}>
                    <Text style={qtyStyles.qtyText}>{quantity}</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={[qtyStyles.btn, (quantity >= maxQty || isLoading) && qtyStyles.btnDisabled]}
                onPress={onIncrement}
                disabled={quantity >= maxQty || isLoading}
            >
                <Text style={qtyStyles.btnText}>+</Text>
            </TouchableOpacity>
        </View>
    );
};

const qtyStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    btn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: lightPalette.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: lightPalette.cardBackground,
    },
    btnDisabled: { opacity: 0.35 },
    btnText: { fontSize: 18, color: lightPalette.textPrimary, fontWeight: '600', lineHeight: 20 },
    qtyText: {
        fontSize: 15,
        fontWeight: '700',
        color: lightPalette.textPrimary,
        minWidth: 24,
        textAlign: 'center',
    },
    input: {
        fontSize: 15,
        fontWeight: '700',
        color: lightPalette.textPrimary,
        minWidth: 32,
        textAlign: 'center',
        borderBottomWidth: 1.5,
        borderBottomColor: lightPalette.primary,
        padding: 0,
    },
});

// ─── CartItem ─────────────────────────────────────────────────────────────────

interface CartItemProps {
    readonly item: CartItemData;
    readonly isSelected: boolean;
    readonly onSelect: (uid: string) => void;
    readonly onDelete: (uid: string) => void;
    readonly onQuantityChange: (uid: string, qty: number) => void;
    readonly onProductPress: (productUid: string) => void;
    readonly isUpdating: boolean;
}

const SWIPE_THRESHOLD = -80;

/**
 * Individual cart item with swipe-to-delete gesture, checkbox selection,
 * quantity controls, and warning badges for price/availability changes.
 * @param props {CartItemProps}
 */
export const CartItem: React.FC<CartItemProps> = ({
    item,
    isSelected,
    onSelect,
    onDelete,
    onQuantityChange,
    onProductPress,
    isUpdating,
}) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const [isRevealed, setIsRevealed] = useState<boolean>(false);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < Math.abs(g.dx),
            onPanResponderMove: (_, g) => {
                const clamped = Math.max(g.dx, -120);
                if (clamped <= 0) {
                    translateX.setValue(clamped);
                }
            },
            onPanResponderRelease: (_, g) => {
                if (g.dx < SWIPE_THRESHOLD) {
                    Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
                    setIsRevealed(true);
                } else {
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
                    setIsRevealed(false);
                }
            },
        })
    ).current;

    const handleSnapBack = useCallback((): void => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        setIsRevealed(false);
    }, [translateX]);

    return (
        <View style={cartItemStyles.wrapper}>
            {/* Swipe delete background */}
            <View style={cartItemStyles.deleteBackground}>
                <TouchableOpacity
                    style={cartItemStyles.deleteBtn}
                    onPress={() => onDelete(item.uid)}
                >
                    <Text style={cartItemStyles.deleteBtnIcon}>🗑️</Text>
                    <Text style={cartItemStyles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
            </View>

            {/* Main card */}
            <Animated.View
                style={[cartItemStyles.container, { transform: [{ translateX }] }]}
                {...panResponder.panHandlers}
            >
                {/* Checkbox */}
                <TouchableOpacity
                    style={[cartItemStyles.checkbox, isSelected && cartItemStyles.checkboxSelected]}
                    onPress={() => onSelect(item.uid)}
                >
                    {isSelected && <Text style={cartItemStyles.checkmark}>✓</Text>}
                </TouchableOpacity>

                {/* Thumbnail */}
                <TouchableOpacity onPress={() => onProductPress(item.productUid)} activeOpacity={0.8}>
                    <View style={cartItemStyles.imageContainer}>
                        {item.thumbnailUrl ? (
                            <Image
                                source={{ uri: item.thumbnailUrl }}
                                style={cartItemStyles.image}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={[cartItemStyles.image, cartItemStyles.imageFallback]}>
                                <Text style={cartItemStyles.imageFallbackText}>📦</Text>
                            </View>
                        )}
                        {!item.isAvailable && (
                            <View style={cartItemStyles.unavailableOverlay}>
                                <Text style={cartItemStyles.unavailableText}>Unavailable</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Info */}
                <View style={cartItemStyles.info}>
                    <Text style={cartItemStyles.productName} numberOfLines={2}>
                        {item.productName}
                    </Text>
                    <Text style={cartItemStyles.variantName}>{item.variantName}</Text>

                    {/* Price */}
                    <View style={cartItemStyles.priceRow}>
                        <Text style={cartItemStyles.price}>{formatPrice(item.price)}</Text>
                        {item.hasPriceChanged && (
                            <View style={cartItemStyles.priceChangedBadge}>
                                <Text style={cartItemStyles.priceChangedText}>Price changed</Text>
                            </View>
                        )}
                    </View>

                    {/* Quantity */}
                    {isUpdating ? (
                        <ActivityIndicator size="small" color={lightPalette.primary} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
                    ) : (
                        <View style={cartItemStyles.qtyRow}>
                            <QuantityControl
                                quantity={item.quantity}
                                maxStock={item.stock}
                                onIncrement={() => onQuantityChange(item.uid, item.quantity + 1)}
                                onDecrement={() => onQuantityChange(item.uid, item.quantity - 1)}
                                onManualInput={(q) => onQuantityChange(item.uid, q)}
                                isLoading={isUpdating}
                            />
                            <Text style={cartItemStyles.subtotal}>
                                = {formatPrice(item.price * item.quantity)}
                            </Text>
                        </View>
                    )}
                </View>
            </Animated.View>
        </View>
    );
};

const cartItemStyles = StyleSheet.create({
    wrapper: { position: 'relative', overflow: 'hidden', marginBottom: 4 },
    deleteBackground: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 80,
        backgroundColor: lightPalette.error,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteBtn: { alignItems: 'center', gap: 4, padding: 8 },
    deleteBtnIcon: { fontSize: 20 },
    deleteBtnText: { color: lightPalette.white, fontSize: 11, fontWeight: '700' },
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: lightPalette.cardBackground,
        padding: 12,
        gap: 12,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: lightPalette.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    checkboxSelected: { backgroundColor: lightPalette.primary, borderColor: lightPalette.primary },
    checkmark: { color: lightPalette.white, fontSize: 13, fontWeight: '700' },
    imageContainer: { position: 'relative' },
    image: { width: 80, height: 80, borderRadius: 10 },
    imageFallback: { backgroundColor: lightPalette.background, justifyContent: 'center', alignItems: 'center' },
    imageFallbackText: { fontSize: 28 },
    unavailableOverlay: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unavailableText: { color: lightPalette.white, fontSize: 10, fontWeight: '700', textAlign: 'center' },
    info: { flex: 1 },
    productName: { fontSize: 14, fontWeight: '700', color: lightPalette.textPrimary, lineHeight: 18 },
    variantName: { fontSize: 12, color: lightPalette.textSecondary, marginTop: 2 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    price: { fontSize: 15, fontWeight: '700', color: lightPalette.primary },
    priceChangedBadge: {
        backgroundColor: 'rgba(251,99,64,0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    priceChangedText: { fontSize: 10, color: lightPalette.warning, fontWeight: '700' },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
    },
    subtotal: { fontSize: 13, color: lightPalette.textSecondary, fontWeight: '600' },
});

// ─── CartSummary ──────────────────────────────────────────────────────────────

interface CartSummaryProps {
    readonly selectedCount: number;
    readonly totalAmount: number;
    readonly onCheckout: () => void;
    readonly isCheckoutDisabled: boolean;
}

/**
 * Fixed bottom bar showing selected item count, total, and checkout button.
 * @param props {CartSummaryProps}
 */
export const CartSummary: React.FC<CartSummaryProps> = ({
    selectedCount,
    totalAmount,
    onCheckout,
    isCheckoutDisabled,
}) => {
    return (
        <View style={summaryStyles.container}>
            <View style={summaryStyles.info}>
                <Text style={summaryStyles.countText}>{selectedCount} item{selectedCount !== 1 ? 's' : ''}</Text>
                <Text style={summaryStyles.totalLabel}>Total:</Text>
                <Text style={summaryStyles.totalAmount}>{formatPrice(totalAmount)}</Text>
            </View>
            <TouchableOpacity
                style={[summaryStyles.checkoutBtn, isCheckoutDisabled && summaryStyles.checkoutBtnDisabled]}
                onPress={onCheckout}
                disabled={isCheckoutDisabled}
            >
                <Text style={summaryStyles.checkoutText}>
                    {isCheckoutDisabled ? 'Select Items' : 'Checkout →'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const summaryStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: lightPalette.cardBackground,
        borderTopWidth: 1,
        borderTopColor: lightPalette.border,
        gap: 12,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
    },
    info: { flex: 1 },
    countText: { fontSize: 12, color: lightPalette.textSecondary },
    totalLabel: { fontSize: 13, color: lightPalette.textSecondary, marginTop: 2 },
    totalAmount: { fontSize: 20, fontWeight: '700', color: lightPalette.textPrimary },
    checkoutBtn: {
        backgroundColor: lightPalette.primary,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
    },
    checkoutBtnDisabled: { backgroundColor: lightPalette.gray },
    checkoutText: { color: lightPalette.white, fontSize: 15, fontWeight: '700' },
});
