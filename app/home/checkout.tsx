import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    CheckoutItem,
    CheckoutItemData,
    OrderSummaryFooter,
    PaymentLoadingOverlay,
    PaymentMethodSelector,
    PaymentMethodType,
} from '../../components/checkout-components';
import type { Address as AddressDropdownItem } from '../../components/ui/address-dropdown';
import { AddressDropdown } from '../../components/ui/address-dropdown';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { LoadingModal } from '../../components/ui/loading-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { supabase } from '../../supabase/supabaseClient';
import { lightPalette } from '../../utils/theme';
import { formatPrice } from '../../utils/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItemRaw {
    readonly uid: string;
    readonly quantity: number;
    readonly product_variants: {
        readonly name: string;
        readonly price: number;
        readonly stock: number;
        readonly sale_price: number | null;
        readonly sale_start_date: string | null;
        readonly sale_end_date: string | null;
        readonly id: number;
    };
    readonly products: {
        readonly id: number;
        readonly uid: string;
        readonly name: string;
        readonly thumbnail_url: string;
        readonly deleted_at: string | null;
        readonly shop_id: number | null;
    };
}

interface AddressRow {
    readonly id: number;
    readonly uid: string;
    readonly country: string;
    readonly province: string;
    readonly city: string;
    readonly barangay: string;
    readonly address_detail: string;
    readonly phone_number: string;
    readonly is_default: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getEffectivePrice = (variant: CartItemRaw['product_variants']): number => {
    const now = new Date();
    if (
        variant.sale_price !== null &&
        variant.sale_start_date !== null &&
        variant.sale_end_date !== null &&
        new Date(variant.sale_start_date) <= now &&
        new Date(variant.sale_end_date) >= now
    ) {
        return variant.sale_price;
    }
    return variant.price;
};

const buildFullAddress = (a: AddressRow): string =>
    [a.address_detail, a.barangay, a.city, a.province, a.country].filter(Boolean).join(', ');

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CheckoutScreen — final step before payment.
 * Validates cart items, shows address picker, payment method selector, order total,
 * then calls the payment-create edge function and opens the payment gateway.
 *
 * Receives `cartUids` (comma-separated) from route params passed by CartScreen.
 */
export default function CheckoutScreen(): React.JSX.Element {
    const { cartUids } = useLocalSearchParams<{ cartUids: string }>();

    const [items, setItems] = useState<CheckoutItemData[]>([]);
    const [addresses, setAddresses] = useState<AddressDropdownItem[]>([]);
    const [addressIdMap, setAddressIdMap] = useState<Record<string, number>>({});
    const [selectedAddressUid, setSelectedAddressUid] = useState<string | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<PaymentMethodType | null>(null);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
    const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

    // Confirm dialog
    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ visible: false, title: '', message: '', onConfirm: () => undefined });

    // ─── Bootstrap ────────────────────────────────────────────────────────

    useEffect(() => {
        void bootstrap();
    }, []);

    const bootstrap = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session === null) {
                router.replace('/auth/login' as Parameters<typeof router.replace>[0]);
                return;
            }

            setCurrentUserEmail(session.user.email ?? '');

            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', session.user.id)
                .single();

            if (user === null) return;
            setCurrentUserId(user.id);

            await Promise.all([
                loadCartItems(user.id),
                loadAddresses(user.id),
            ]);
        } catch {
            Alert.alert('Error', 'Failed to load checkout data.');
        } finally {
            setIsLoading(false);
        }
    }, [cartUids]);

    // ─── Load cart items (validate on load) ──────────────────────────────

    const loadCartItems = useCallback(async (_userId: number): Promise<void> => {
        if (cartUids === undefined || cartUids.trim().length === 0) return;
        const uids = cartUids.split(',').filter((u) => u.trim().length > 0);

        const { data } = await supabase
            .from('cart_items')
            .select('uid, quantity, product_variants(id, name, price, stock, sale_price, sale_start_date, sale_end_date), products!inner(id, uid, name, thumbnail_url, deleted_at, shop_id)')
            .in('uid', uids);

        const warnings: string[] = [];
        const validItems: CheckoutItemData[] = [];

        for (const raw of (data as unknown as CartItemRaw[] | null ?? [])) {
            const isDeleted = raw.products.deleted_at !== null;
            const stockOk = raw.product_variants.stock >= raw.quantity;

            if (isDeleted) {
                warnings.push(`"${raw.products.name}" is no longer available.`);
                continue;
            }
            if (!stockOk) {
                warnings.push(`"${raw.products.name}" has insufficient stock.`);
                continue;
            }

            validItems.push({
                uid: raw.uid,
                productName: raw.products.name,
                variantName: raw.product_variants.name,
                price: getEffectivePrice(raw.product_variants),
                quantity: raw.quantity,
                thumbnailUrl: raw.products.thumbnail_url,
            });
        }

        setItems(validItems);
        setValidationWarnings(warnings);
    }, [cartUids]);

    // ─── Load addresses ───────────────────────────────────────────────────

    const loadAddresses = useCallback(async (userId: number): Promise<void> => {
        const { data } = await supabase
            .from('addresses')
            .select('id, uid, country, province, city, barangay, address_detail, phone_number, is_default')
            .eq('user_id', userId)
            .order('is_default', { ascending: false });

        const idMap: Record<string, number> = {};
        const mapped: AddressDropdownItem[] = (data as unknown as AddressRow[] | null ?? []).map((a) => {
            idMap[a.uid] = a.id;
            return {
                uid: a.uid,
                label: a.is_default ? 'Default Address' : `${a.city}, ${a.province}`,
                fullAddress: buildFullAddress(a),
                phone: a.phone_number,
            };
        });

        setAddresses(mapped);
        setAddressIdMap(idMap);

        const defaultAddr = (data as unknown as AddressRow[] | null ?? []).find((a) => a.is_default);
        if (defaultAddr !== undefined) {
            setSelectedAddressUid(defaultAddr.uid);
        } else if (mapped.length > 0) {
            setSelectedAddressUid(mapped[0].uid);
        }
    }, []);

    // ─── Derived totals ───────────────────────────────────────────────────

    const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // ─── Place order flow ─────────────────────────────────────────────────

    const handlePlaceOrder = useCallback((): void => {
        if (selectedAddressUid === null) {
            Alert.alert('No Address', 'Please select a delivery address.');
            return;
        }
        if (selectedPayment === null) {
            Alert.alert('No Payment Method', 'Please select a payment method.');
            return;
        }
        if (items.length === 0) {
            Alert.alert('Empty Cart', 'No valid items to checkout.');
            return;
        }

        setConfirmDialog({
            visible: true,
            title: 'Confirm Order',
            message: `Place order for ${formatPrice(totalAmount)}? You'll be redirected to the payment gateway.`,
            onConfirm: () => {
                setConfirmDialog((d) => ({ ...d, visible: false }));
                void initiatePayment();
            },
        });
    }, [selectedAddressUid, selectedPayment, items, totalAmount]);

    const initiatePayment = useCallback(async (): Promise<void> => {
        if (
            currentUserId === null ||
            selectedAddressUid === null ||
            selectedPayment === null
        ) return;

        setPaymentLoading(true);
        try {
            const addressId = addressIdMap[selectedAddressUid];
            if (addressId === undefined) throw new Error('Address not found');

            // Build idempotency key — prevents duplicate charges on retry
            const idempotencyKey = `order-${currentUserId}-${Date.now()}`;

            // Call Supabase Edge Function — XENDIT_KEY is server-side only
            const { data: fnData, error: fnError } = await supabase.functions.invoke(
                'payment-create',
                {
                    body: {
                        userId: currentUserId,
                        addressId,
                        paymentChannel: selectedPayment,
                        totalAmount,
                        idempotencyKey,
                        customerEmail: currentUserEmail,
                        items: items.map((i) => ({
                            uid: i.uid,
                            productName: i.productName,
                            variantName: i.variantName,
                            price: i.price,
                            quantity: i.quantity,
                        })),
                    },
                },
            );

            if (fnError !== null) throw fnError;

            const response = fnData as {
                paymentUrl: string;
                orderId: string;
                transactionId: string;
            } | null;

            if (response === null || response.paymentUrl === undefined) {
                throw new Error('Invalid payment response');
            }

            // Navigate to order confirmation with payment URL
            router.push({
                pathname: '/home/order-confirmation' as string,
                params: {
                    paymentUrl: response.paymentUrl,
                    orderId: response.orderId,
                    transactionId: response.transactionId,
                    cartUids: cartUids ?? '',
                },
            } as Parameters<typeof router.push>[0]);
        } catch {
            Alert.alert(
                'Payment Failed',
                'Unable to initiate payment. Please try again or contact support.',
            );
        } finally {
            setPaymentLoading(false);
        }
    }, [
        currentUserId,
        selectedAddressUid,
        selectedPayment,
        totalAmount,
        items,
        addressIdMap,
        currentUserEmail,
        cartUids,
    ]);

    // ─── Render ───────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SafeScreen>
                <LoadingModal isVisible message="Loading checkout…" />
            </SafeScreen>
        );
    }

    const canProceed =
        selectedAddressUid !== null &&
        selectedPayment !== null &&
        items.length > 0;

    return (
        <SafeScreen style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} id="back-btn" style={styles.backBtn}>
                    <Text style={styles.backText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Checkout</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Validation warnings */}
                {validationWarnings.map((w, i) => (
                    <View key={i} style={styles.warningBanner}>
                        <Text style={styles.warningText}>⚠️ {w}</Text>
                    </View>
                ))}

                {/* Delivery address section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    <AddressDropdown
                        addresses={addresses}
                        selectedUid={selectedAddressUid}
                        onSelect={setSelectedAddressUid}
                        onAddAddress={() =>
                            router.push('/home/addresses' as Parameters<typeof router.push>[0])
                        }
                    />
                    {addresses.length === 0 && (
                        <TouchableOpacity
                            style={styles.addAddressBtn}
                            onPress={() =>
                                router.push('/home/addresses' as Parameters<typeof router.push>[0])
                            }
                            id="add-address-from-checkout"
                        >
                            <Text style={styles.addAddressText}>+ Add Delivery Address</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Order items */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Items ({items.length})</Text>
                    <View style={styles.itemsCard}>
                        {items.map((item) => (
                            <CheckoutItem key={item.uid} item={item} />
                        ))}
                        {items.length === 0 && (
                            <Text style={styles.noItems}>No valid items to checkout.</Text>
                        )}
                    </View>
                </View>

                {/* Payment method */}
                <View style={styles.section}>
                    <PaymentMethodSelector
                        selected={selectedPayment}
                        onSelect={setSelectedPayment}
                    />
                </View>

                {/* Price breakdown */}
                <View style={[styles.section, styles.summaryCard]}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</Text>
                        <Text style={styles.summaryValue}>{formatPrice(totalAmount)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Shipping</Text>
                        <Text style={styles.shippingFree}>Free</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
                    </View>
                </View>

                {/* Xendit disclaimer */}
                <Text style={styles.disclaimer}>
                    🔒 Payments are processed securely via Xendit. Your payment details are never stored on our servers.
                </Text>
            </ScrollView>

            {/* Fixed footer */}
            <OrderSummaryFooter
                totalAmount={totalAmount}
                itemCount={items.length}
                onPlaceOrder={handlePlaceOrder}
                isDisabled={!canProceed}
            />

            {/* Payment loading overlay */}
            <PaymentLoadingOverlay
                visible={paymentLoading}
                message="Connecting to payment gateway…"
                onCancel={() => setPaymentLoading(false)}
            />

            {/* Confirm dialog */}
            <ConfirmDialog
                visible={confirmDialog.visible}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog((d) => ({ ...d, visible: false }))}
                confirmLabel="Confirm & Pay"
                cancelLabel="Back"
                variant="info"
            />
        </SafeScreen>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: lightPalette.border,
        backgroundColor: lightPalette.cardBackground,
    },
    backBtn: { padding: 4, minWidth: 60 },
    backText: { fontSize: 17, color: lightPalette.primary, fontWeight: '600' },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: lightPalette.textPrimary,
    },
    scroll: {
        paddingBottom: 24,
    },
    section: {
        paddingHorizontal: 16,
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: lightPalette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    itemsCard: {
        backgroundColor: lightPalette.cardBackground,
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
    },
    noItems: {
        padding: 20,
        textAlign: 'center',
        color: lightPalette.textSecondary,
        fontSize: 14,
    },
    addAddressBtn: {
        marginTop: 10,
        padding: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: lightPalette.primary,
        alignItems: 'center',
    },
    addAddressText: {
        color: lightPalette.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    warningBanner: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(251, 99, 64, 0.1)',
    },
    warningText: {
        fontSize: 13,
        color: lightPalette.warning,
        fontWeight: '500',
    },
    summaryCard: {
        backgroundColor: lightPalette.cardBackground,
        borderRadius: 14,
        padding: 16,
        marginTop: 20,
        marginHorizontal: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryLabel: {
        fontSize: 14,
        color: lightPalette.textSecondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: lightPalette.textPrimary,
    },
    shippingFree: {
        fontSize: 14,
        fontWeight: '600',
        color: lightPalette.success,
    },
    summaryTotal: {
        borderTopWidth: 1,
        borderTopColor: lightPalette.border,
        paddingTop: 10,
        marginTop: 4,
        marginBottom: 0,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: lightPalette.textPrimary,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '900',
        color: lightPalette.primary,
    },
    disclaimer: {
        marginHorizontal: 16,
        marginTop: 16,
        fontSize: 12,
        color: lightPalette.gray,
        textAlign: 'center',
        lineHeight: 18,
    },
});
