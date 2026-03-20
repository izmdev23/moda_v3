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
import { formatPrice } from '../utils/utils';
import { useTheme } from './ui/theme-provider';

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
    const { theme } = useTheme();
    return (
        <View style={[bannerStyles.container, { backgroundColor: `${theme.warning}1A`, borderLeftColor: theme.warning }]}>
            <Text style={bannerStyles.icon}>⚠️</Text>
            <Text style={[bannerStyles.text, { color: theme.textPrimary }]}>{message}</Text>
        </View>
    );
};

const bannerStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderLeftWidth: 4,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 8,
    },
    icon: { fontSize: 16 },
    text: { flex: 1, fontSize: 13, lineHeight: 18 },
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
    const { theme } = useTheme();
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
                style={[qtyStyles.btn, { borderColor: theme.border, backgroundColor: theme.cardBackground }, (quantity <= 1 || isLoading) && qtyStyles.btnDisabled]}
                onPress={onDecrement}
                disabled={quantity <= 1 || isLoading}
            >
                <Text style={[qtyStyles.btnText, { color: theme.textPrimary }]}>−</Text>
            </TouchableOpacity>

            {isEditing ? (
                <TextInput
                    style={[qtyStyles.input, { color: theme.textPrimary, borderBottomColor: theme.primary }]}
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
                    <Text style={[qtyStyles.qtyText, { color: theme.textPrimary }]}>{quantity}</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={[qtyStyles.btn, { borderColor: theme.border, backgroundColor: theme.cardBackground }, (quantity >= maxQty || isLoading) && qtyStyles.btnDisabled]}
                onPress={onIncrement}
                disabled={quantity >= maxQty || isLoading}
            >
                <Text style={[qtyStyles.btnText, { color: theme.textPrimary }]}>+</Text>
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnDisabled: { opacity: 0.35 },
    btnText: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
    qtyText: {
        fontSize: 15,
        fontWeight: '700',
        minWidth: 24,
        textAlign: 'center',
    },
    input: {
        fontSize: 15,
        fontWeight: '700',
        minWidth: 32,
        textAlign: 'center',
        borderBottomWidth: 1.5,
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
    const { theme } = useTheme();
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

    // Suppress unused warning for isRevealed/handleSnapBack (used indirectly via gesture)
    void isRevealed;
    void handleSnapBack;

    return (
        <View style={cartItemStyles.wrapper}>
            {/* Swipe delete background */}
            <View style={[cartItemStyles.deleteBackground, { backgroundColor: theme.error }]}>
                <TouchableOpacity
                    style={cartItemStyles.deleteBtn}
                    onPress={() => onDelete(item.uid)}
                >
                    <Text style={cartItemStyles.deleteBtnIcon}>🗑️</Text>
                    <Text style={[cartItemStyles.deleteBtnText, { color: theme.white }]}>Delete</Text>
                </TouchableOpacity>
            </View>

            {/* Main card */}
            <Animated.View
                style={[cartItemStyles.container, { backgroundColor: theme.cardBackground, transform: [{ translateX }] }]}
                {...panResponder.panHandlers}
            >
                {/* Checkbox */}
                <TouchableOpacity
                    style={[cartItemStyles.checkbox, { borderColor: theme.border }, isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => onSelect(item.uid)}
                >
                    {isSelected && <Text style={[cartItemStyles.checkmark, { color: theme.white }]}>✓</Text>}
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
                            <View style={[cartItemStyles.image, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={cartItemStyles.imageFallbackText}>📦</Text>
                            </View>
                        )}
                        {!item.isAvailable && (
                            <View style={cartItemStyles.unavailableOverlay}>
                                <Text style={[cartItemStyles.unavailableText, { color: theme.white }]}>Unavailable</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Info */}
                <View style={cartItemStyles.info}>
                    <Text style={[cartItemStyles.productName, { color: theme.textPrimary }]} numberOfLines={2}>
                        {item.productName}
                    </Text>
                    <Text style={[cartItemStyles.variantName, { color: theme.textSecondary }]}>{item.variantName}</Text>

                    {/* Price */}
                    <View style={cartItemStyles.priceRow}>
                        <Text style={[cartItemStyles.price, { color: theme.primary }]}>{formatPrice(item.price)}</Text>
                        {item.hasPriceChanged && (
                            <View style={[cartItemStyles.priceChangedBadge, { backgroundColor: `${theme.warning}26` }]}>
                                <Text style={[cartItemStyles.priceChangedText, { color: theme.warning }]}>Price changed</Text>
                            </View>
                        )}
                    </View>

                    {/* Quantity */}
                    {isUpdating ? (
                        <ActivityIndicator size="small" color={theme.primary} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
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
                            <Text style={[cartItemStyles.subtotal, { color: theme.textSecondary }]}>
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteBtn: { alignItems: 'center', gap: 4, padding: 8 },
    deleteBtnIcon: { fontSize: 20 },
    deleteBtnText: { fontSize: 11, fontWeight: '700' },
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        gap: 12,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    checkmark: { fontSize: 13, fontWeight: '700' },
    imageContainer: { position: 'relative' },
    image: { width: 80, height: 80, borderRadius: 10 },
    imageFallbackText: { fontSize: 28 },
    unavailableOverlay: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unavailableText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
    info: { flex: 1 },
    productName: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
    variantName: { fontSize: 12, marginTop: 2 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    price: { fontSize: 15, fontWeight: '700' },
    priceChangedBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    priceChangedText: { fontSize: 10, fontWeight: '700' },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
    },
    subtotal: { fontSize: 13, fontWeight: '600' },
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
    const { theme } = useTheme();
    return (
        <View style={[summaryStyles.container, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
            <View style={summaryStyles.info}>
                <Text style={[summaryStyles.countText, { color: theme.textSecondary }]}>{selectedCount} item{selectedCount !== 1 ? 's' : ''}</Text>
                <Text style={[summaryStyles.totalLabel, { color: theme.textSecondary }]}>Total:</Text>
                <Text style={[summaryStyles.totalAmount, { color: theme.textPrimary }]}>{formatPrice(totalAmount)}</Text>
            </View>
            <TouchableOpacity
                style={[summaryStyles.checkoutBtn, { backgroundColor: isCheckoutDisabled ? theme.gray : theme.primary }]}
                onPress={onCheckout}
                disabled={isCheckoutDisabled}
            >
                <Text style={[summaryStyles.checkoutText, { color: theme.white }]}>
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
        borderTopWidth: 1,
        gap: 12,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
    },
    info: { flex: 1 },
    countText: { fontSize: 12 },
    totalLabel: { fontSize: 13, marginTop: 2 },
    totalAmount: { fontSize: 20, fontWeight: '700' },
    checkoutBtn: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
    },
    checkoutText: { fontSize: 15, fontWeight: '700' },
});
