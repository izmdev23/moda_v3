import React from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { lightPalette } from '../utils/theme';
import { formatPrice } from '../utils/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckoutItemData {
    readonly uid: string;
    readonly productName: string;
    readonly variantName: string;
    readonly price: number;
    readonly quantity: number;
    readonly thumbnailUrl: string;
}

export type PaymentMethodType = 'gcash' | 'paymaya';

export interface PaymentMethodOption {
    readonly type: PaymentMethodType;
    readonly label: string;
    readonly icon: string;
    readonly description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAYMENT_OPTIONS: PaymentMethodOption[] = [
    {
        type: 'gcash',
        label: 'GCash',
        icon: '💙',
        description: 'Pay via GCash e-wallet',
    },
    {
        type: 'paymaya',
        label: 'Maya',
        icon: '💚',
        description: 'Pay via Maya (formerly PayMaya)',
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
    const subtotal = item.price * item.quantity;

    return (
        <View style={styles.checkoutItem}>
            <Image
                source={{ uri: item.thumbnailUrl }}
                style={styles.itemThumb}
                resizeMode="cover"
            />
            <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                    {item.productName}
                </Text>
                <Text style={styles.itemVariant}>{item.variantName}</Text>
                <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
            </View>
            <Text style={styles.itemSubtotal}>{formatPrice(subtotal)}</Text>
        </View>
    );
};

// ─── PaymentMethodSelector ────────────────────────────────────────────────────

interface PaymentMethodSelectorProps {
    readonly selected: PaymentMethodType | null;
    readonly onSelect: (type: PaymentMethodType) => void;
}

/**
 * Horizontal card-based selector for GCash and Maya payment options.
 * Highlights the selected option with a primary border.
 */
export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
    selected,
    onSelect,
}): React.JSX.Element => {
    return (
        <View style={styles.paymentContainer}>
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <View style={styles.paymentRow}>
                {PAYMENT_OPTIONS.map((option) => {
                    const isSelected = selected === option.type;
                    return (
                        <TouchableOpacity
                            key={option.type}
                            style={[styles.paymentCard, isSelected && styles.paymentCardSelected]}
                            onPress={() => onSelect(option.type)}
                            activeOpacity={0.75}
                            id={`payment-method-${option.type}`}
                        >
                            <Text style={styles.paymentIcon}>{option.icon}</Text>
                            <Text
                                style={[
                                    styles.paymentLabel,
                                    isSelected && styles.paymentLabelSelected,
                                ]}
                            >
                                {option.label}
                            </Text>
                            <Text style={styles.paymentDesc}>{option.description}</Text>
                            {isSelected && (
                                <View style={styles.selectedIndicator}>
                                    <Text style={styles.selectedCheck}>✓</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
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
    return (
        <View style={styles.footer}>
            <View style={styles.footerAmounts}>
                <Text style={styles.footerItems}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
                <Text style={styles.footerTotal}>{formatPrice(totalAmount)}</Text>
            </View>
            <TouchableOpacity
                style={[styles.placeOrderBtn, isDisabled && styles.placeOrderBtnDisabled]}
                onPress={onPlaceOrder}
                disabled={isDisabled}
                id="place-order-button"
            >
                <Text style={styles.placeOrderText}>Place Order</Text>
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
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.paymentOverlay}>
                <View style={styles.paymentOverlayCard}>
                    <ActivityIndicator size="small" color={lightPalette.primary} />
                    <Text style={styles.paymentOverlayTitle}>Processing Payment</Text>
                    <Text style={styles.paymentOverlayMessage}>{message}</Text>
                    {onCancel !== undefined && (
                        <TouchableOpacity
                            style={styles.paymentCancelBtn}
                            onPress={onCancel}
                            id="cancel-payment-button"
                        >
                            <Text style={styles.paymentCancelText}>Cancel</Text>
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
        borderBottomColor: lightPalette.border,
    },
    itemThumb: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: lightPalette.border,
        marginRight: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
        color: lightPalette.textPrimary,
        marginBottom: 2,
    },
    itemVariant: {
        fontSize: 13,
        color: lightPalette.textSecondary,
        marginBottom: 2,
    },
    itemQty: {
        fontSize: 12,
        color: lightPalette.gray,
    },
    itemSubtotal: {
        fontSize: 15,
        fontWeight: '800',
        color: lightPalette.textPrimary,
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
        color: lightPalette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    paymentRow: {
        flexDirection: 'row',
        gap: 12,
    },
    paymentCard: {
        flex: 1,
        padding: 16,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: lightPalette.border,
        backgroundColor: lightPalette.cardBackground,
        alignItems: 'center',
        position: 'relative',
    },
    paymentCardSelected: {
        borderColor: lightPalette.primary,
        backgroundColor: 'rgba(244,67,54,0.04)',
    },
    paymentIcon: {
        fontSize: 28,
        marginBottom: 6,
    },
    paymentLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: lightPalette.textPrimary,
        marginBottom: 4,
    },
    paymentLabelSelected: {
        color: lightPalette.primary,
    },
    paymentDesc: {
        fontSize: 11,
        color: lightPalette.textSecondary,
        textAlign: 'center',
    },
    selectedIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: lightPalette.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedCheck: {
        color: lightPalette.white,
        fontSize: 12,
        fontWeight: '900',
    },

    // OrderSummaryFooter
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: lightPalette.border,
        backgroundColor: lightPalette.cardBackground,
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
        color: lightPalette.textSecondary,
    },
    footerTotal: {
        fontSize: 22,
        fontWeight: '900',
        color: lightPalette.primary,
    },
    placeOrderBtn: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        backgroundColor: lightPalette.primary,
        borderRadius: 12,
    },
    placeOrderBtnDisabled: {
        opacity: 0.4,
    },
    placeOrderText: {
        color: lightPalette.white,
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
        backgroundColor: lightPalette.cardBackground,
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
        color: lightPalette.textPrimary,
        marginTop: 16,
        marginBottom: 8,
    },
    paymentOverlayMessage: {
        fontSize: 14,
        color: lightPalette.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    paymentCancelBtn: {
        marginTop: 24,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 10,
        backgroundColor: lightPalette.border,
    },
    paymentCancelText: {
        fontSize: 14,
        fontWeight: '700',
        color: lightPalette.textSecondary,
    },
});
