import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { usePaymentMethods } from '../hooks/use-payment-methods';
import { formatPrice } from '../utils/utils';
import { useTheme } from './ui/theme-provider';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckoutItemData {
    readonly uid: string;
    readonly productName: string;
    readonly variantName: string;
    readonly price: number;
    readonly quantity: number;
    readonly thumbnailUrl: string;
    readonly productId?: number;
    readonly variantId?: number;
}

export type PaymentMethodType = 'gcash' | 'paymaya' | 'card';

export interface PaymentMethodOption {
    readonly type: PaymentMethodType;
    readonly label: string;
    readonly icon: string;
    readonly description: string;
    readonly disabled?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAYMENT_OPTIONS: PaymentMethodOption[] = [
    {
        type: 'gcash',
        label: 'GCash',
        icon: '💙',
        description: 'Currently Unavailable',
        disabled: true,
    },
    {
        type: 'paymaya',
        label: 'Maya',
        icon: '💚',
        description: 'Pay via Maya (formerly PayMaya)',
    },
    {
        type: 'card',
        label: 'Credit / Debit Card',
        icon: '💳',
        description: 'Visa, Mastercard, etc.',
    },
];

// ─── CheckoutItem ─────────────────────────────────────────────────────────────

interface CheckoutItemProps {
    readonly item: CheckoutItemData;
}

/**
 * Displays a single line item in the checkout summary.
 * Shows thumbnail, product name, variant, quantity, and subtotal.
 */
export const CheckoutItem: React.FC<CheckoutItemProps> = ({ item }): React.JSX.Element => {
    const { theme } = useTheme();
    const subtotal = item.price * item.quantity;

    return (
        <View style={[styles.checkoutItem, { borderBottomColor: theme.border }]}>
            <Image
                source={{ uri: item.thumbnailUrl }}
                style={[styles.itemThumb, { backgroundColor: theme.border }]}
                resizeMode="cover"
            />
            <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: theme.textPrimary }]} numberOfLines={2}>
                    {item.productName}
                </Text>
                <Text style={[styles.itemVariant, { color: theme.textSecondary }]}>{item.variantName}</Text>
                <Text style={[styles.itemQty, { color: theme.gray }]}>Qty: {item.quantity}</Text>
            </View>
            <Text style={[styles.itemSubtotal, { color: theme.textPrimary }]}>{formatPrice(subtotal)}</Text>
        </View>
    );
};

// ─── PaymentMethodSelector ────────────────────────────────────────────────────

interface PaymentMethodSelectorProps {
    readonly userId: number;
    readonly selectedMethodUid: string | null;
    readonly onSelect: (uid: string, type: PaymentMethodType, accountNumber: string) => void;
    readonly onAddNew: () => void;
    readonly onEmpty?: () => void;
}

/**
 * Horizontal card-based selector for user's saved payment methods.
 */
export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
    userId,
    selectedMethodUid,
    onSelect,
    onAddNew,
    onEmpty,
}): React.JSX.Element => {
    const { theme } = useTheme();
    const { data: methods = [], isLoading } = usePaymentMethods(userId);

    // Auto-select a payment method when methods load or change (e.g. after returning
    // from the Add Payment screen). Invalidation in useAddPaymentMethod / useDeletePaymentMethod
    // triggers a refetch, so this effect runs with fresh data automatically.
    useEffect(() => {
        if (isLoading) return;
        if (methods.length === 0) {
            onEmpty?.();
            return;
        }
        if (selectedMethodUid !== null) return;

        const def = methods.find((m) => {
            const opt = PAYMENT_OPTIONS.find((o) => o.type === m.type);
            return m.is_default && !opt?.disabled;
        });
        if (def) {
            onSelect(def.uid, def.type as PaymentMethodType, def.account_number);
        } else {
            const firstAvailable = methods.find((m) => {
                const opt = PAYMENT_OPTIONS.find((o) => o.type === m.type);
                return !opt?.disabled;
            });
            if (firstAvailable) {
                onSelect(firstAvailable.uid, firstAvailable.type as PaymentMethodType, firstAvailable.account_number);
            }
        }
    }, [methods, isLoading]);

    return (
        <View style={styles.paymentContainer}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Payment Method</Text>
            {isLoading ? (
                <View style={[styles.paymentCard, { borderColor: theme.border, backgroundColor: theme.cardBackground, paddingVertical: 24 }]}>
                    <ActivityIndicator size="small" color={theme.primary} />
                </View>
            ) : (
                <View style={styles.paymentMethodsList}>
                    {methods.map((method, index) => {
                        const isSelected = selectedMethodUid === method.uid;
                        // Find matching options for icon and label
                        const optionInfo = PAYMENT_OPTIONS.find(o => o.type === method.type) || { icon: '💳', label: method.type, description: 'Payment Method', type: method.type as PaymentMethodType };

                        // Add a separator before the first card if preceded by e-wallets
                        const showSeparator = index > 0 && method.type === 'card' && methods[index - 1].type !== 'card';

                        return (
                            <React.Fragment key={method.uid}>
                                {showSeparator && (
                                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 8 }} />
                                )}
                                <TouchableOpacity
                                    style={[
                                        styles.paymentCardRow, 
                                        { borderColor: theme.border, backgroundColor: theme.cardBackground }, 
                                        isSelected && { borderColor: theme.primary, backgroundColor: theme.primary + '0A' },
                                        optionInfo.disabled && { opacity: 0.5, backgroundColor: theme.border + '1A' }
                                    ]}
                                    onPress={() => !optionInfo.disabled && onSelect(method.uid, optionInfo.type, method.account_number)}
                                    activeOpacity={optionInfo.disabled ? 1 : 0.75}
                                    disabled={optionInfo.disabled}
                                >
                                    <Text style={[styles.paymentIconRow, optionInfo.disabled && { grayscale: 1 } as any]}>{optionInfo.icon}</Text>
                                    <View style={styles.paymentInfoRow}>
                                        <Text
                                            style={[
                                                styles.paymentLabel,
                                                { color: isSelected ? theme.primary : theme.textPrimary },
                                                optionInfo.disabled && { color: theme.gray }
                                            ]}
                                        >
                                            {optionInfo.label} •••• {method.account_number.slice(-4)}
                                        </Text>
                                        <Text style={[styles.paymentDesc, { color: optionInfo.disabled ? theme.gray : theme.textSecondary }]}>
                                            {optionInfo.disabled ? 'Currently Unavailable' : (method.is_default ? 'Default' : optionInfo.description)}
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <View style={[styles.selectedIndicatorRow, { backgroundColor: theme.primary }]}>
                                            <Text style={[styles.selectedCheck, { color: theme.white }]}>✓</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </React.Fragment>
                        );
                    })}

                    <TouchableOpacity
                        style={[styles.addMethodBtn, { borderColor: theme.primary, backgroundColor: theme.primary + '05' }]}
                        onPress={onAddNew}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.addMethodText, { color: theme.primary }]}>+ Add New Method</Text>
                    </TouchableOpacity>

                    {methods.length === 0 && (
                        <Text style={[styles.noMethodsText, { color: theme.warning }]}>No payment methods found. Please add one.</Text>
                    )}
                </View>
            )}
        </View>
    );
};

// ─── OrderSummaryFooter ───────────────────────────────────────────────────────

interface OrderSummaryFooterProps {
    readonly totalAmount: number;
    readonly itemCount: number;
    readonly onPlaceOrder: () => void;
    readonly isDisabled: boolean;
}

/**
 * Fixed bottom bar showing total price, item count, and Place Order CTA.
 * Disabled when no payment method is selected or items are unavailable.
 */
export const OrderSummaryFooter: React.FC<OrderSummaryFooterProps> = ({
    totalAmount,
    itemCount,
    onPlaceOrder,
    isDisabled,
}): React.JSX.Element => {
    const { theme } = useTheme();
    return (
        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.cardBackground }]}>
            <View style={styles.footerAmounts}>
                <Text style={[styles.footerItems, { color: theme.textSecondary }]}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
                <Text style={[styles.footerTotal, { color: theme.primary }]}>{formatPrice(totalAmount)}</Text>
            </View>
            <TouchableOpacity
                style={[styles.placeOrderBtn, { backgroundColor: theme.primary }, isDisabled && styles.placeOrderBtnDisabled]}
                onPress={onPlaceOrder}
                disabled={isDisabled}
                id="place-order-button"
            >
                <Text style={[styles.placeOrderText, { color: theme.white }]}>Place Order</Text>
            </TouchableOpacity>
        </View>
    );
};

// ─── PaymentLoadingOverlay ────────────────────────────────────────────────────

interface PaymentLoadingOverlayProps {
    readonly visible: boolean;
    readonly message: string;
    readonly onCancel?: () => void;
}

/**
 * Full-screen blocking overlay shown while the payment gateway is processing.
 * Includes optional cancel button for user escape hatch.
 */
export const PaymentLoadingOverlay: React.FC<PaymentLoadingOverlayProps> = ({
    visible,
    message,
    onCancel,
}): React.JSX.Element => {
    const { theme } = useTheme();
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.paymentOverlay}>
                <View style={[styles.paymentOverlayCard, { backgroundColor: theme.cardBackground }]}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.paymentOverlayTitle, { color: theme.textPrimary }]}>Processing Payment</Text>
                    <Text style={[styles.paymentOverlayMessage, { color: theme.textSecondary }]}>{message}</Text>
                    {onCancel !== undefined && (
                        <TouchableOpacity
                            style={[styles.paymentCancelBtn, { backgroundColor: theme.border }]}
                            onPress={onCancel}
                            id="cancel-payment-button"
                        >
                            <Text style={[styles.paymentCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // CheckoutItem
    checkoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    itemThumb: {
        width: 64,
        height: 64,
        borderRadius: 8,
        marginRight: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    itemVariant: {
        fontSize: 13,
        marginBottom: 2,
    },
    itemQty: {
        fontSize: 12,
    },
    itemSubtotal: {
        fontSize: 15,
        fontWeight: '800',
        marginLeft: 8,
    },

    // PaymentMethodSelector
    paymentContainer: {
        paddingHorizontal: 16,
        marginVertical: 12,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    paymentMethodsList: {
        flexDirection: 'column',
        gap: 12,
    },
    paymentCardRow: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 14,
        borderWidth: 2,
        alignItems: 'center',
        position: 'relative',
    },
    paymentIconRow: {
        fontSize: 24,
        marginRight: 12,
    },
    paymentInfoRow: {
        flex: 1,
    },
    paymentLabel: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    paymentDesc: {
        fontSize: 12,
    },
    selectedIndicatorRow: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    selectedCheck: {
        fontSize: 12,
        fontWeight: '900',
    },
    addMethodBtn: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addMethodText: {
        fontWeight: '700',
        fontSize: 14,
    },
    noMethodsText: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 4,
        fontWeight: '500',
    },
    paymentCard: {
        borderRadius: 14,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // OrderSummaryFooter
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        gap: 16,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    footerAmounts: {
        flex: 1,
    },
    footerItems: {
        fontSize: 12,
    },
    footerTotal: {
        fontSize: 22,
        fontWeight: '900',
    },
    placeOrderBtn: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
    },
    placeOrderBtnDisabled: {
        opacity: 0.4,
    },
    placeOrderText: {
        fontWeight: '800',
        fontSize: 16,
    },

    // PaymentLoadingOverlay
    paymentOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    paymentOverlayCard: {
        borderRadius: 20,
        padding: 32,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
    },
    paymentOverlayTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginTop: 16,
        marginBottom: 8,
    },
    paymentOverlayMessage: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    paymentCancelBtn: {
        marginTop: 24,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 10,
    },
    paymentCancelText: {
        fontSize: 14,
        fontWeight: '700',
    },
});
