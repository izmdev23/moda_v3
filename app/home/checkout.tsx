import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { useStripe } from '@stripe/stripe-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    BackHandler, ScrollView, StyleSheet, Text, View
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
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useAddresses, type AddressRow } from '../../hooks/use-addresses';
import { useCurrentUser } from '../../hooks/use-current-user';
import { getStripePaymentMethodIdFromStoredAccount } from '../../hooks/use-payment-methods';
import { supabase } from '../../supabase/supabaseClient';
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
    const { theme } = useTheme();
    const { confirmPayment } = useStripe();

    // ── Identity + addresses from cache ───────────────────────────────────
    const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
    const userId = currentUser?.id ?? null;
    const { data: rawAddresses = [], isLoading: isAddressesLoading } = useAddresses(userId);

    // Transform raw address rows to dropdown items
    const addresses: AddressDropdownItem[] = rawAddresses.map((a) => ({
        uid: a.uid,
        label: a.is_default ? 'Default Address' : `${a.city}, ${a.province}`,
        fullAddress: buildFullAddress(a),
        phone: a.phone_number,
    }));
    const addressIdMap: Record<string, number> = Object.fromEntries(rawAddresses.map((a) => [a.uid, a.id]));

    const [items, setItems] = useState<CheckoutItemData[]>([]);
    const [cartItemsLoading, setCartItemsLoading] = useState<boolean>(true);
    const [selectedAddressUid, setSelectedAddressUid] = useState<string | null>(null);
    const [selectedPaymentUid, setSelectedPaymentUid] = useState<string | null>(null);
    const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentMethodType | string | null>(null);
    const [selectedPaymentAccountNumber, setSelectedPaymentAccountNumber] = useState<string | null>(null);
    const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
    const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

    const isLoading = isUserLoading || isAddressesLoading || cartItemsLoading;

    // Confirm dialog
    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ visible: false, title: '', message: '', onConfirm: () => undefined });

    const [noMethodsDialogVisible, setNoMethodsDialogVisible] = useState(false);

    // ── Auto-select default address when addresses load ───────────────────
    useEffect(() => {
        if (rawAddresses.length === 0 || selectedAddressUid !== null) return;
        const def = rawAddresses.find((a) => a.is_default);
        setSelectedAddressUid(def?.uid ?? rawAddresses[0].uid);
    }, [rawAddresses]);

    // ── Block hardware back during active payment processing ──────────────
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (paymentLoading) return true;
            return false;
        });
        return () => subscription.remove();
    }, [paymentLoading]);

    // ─── Load cart items when userId is ready ─────────────────────────────

    useEffect(() => {
        if (userId === null) return;
        void loadCartItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const loadCartItems = useCallback(async (): Promise<void> => {
        if (cartUids === undefined || cartUids.trim().length === 0) {
            setCartItemsLoading(false);
            return;
        }
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
                productId: raw.products.id,
                variantId: raw.product_variants.id,
            });
        }

        setItems(validItems);
        setValidationWarnings(warnings);
        setCartItemsLoading(false);
    }, [cartUids]);

    // ─── Derived totals ───────────────────────────────────────────────────

    const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // ─── Place order flow ─────────────────────────────────────────────────

    const handlePlaceOrder = useCallback((): void => {
        if (selectedAddressUid === null) {
            AppAlert.alert('No Address', 'Please select a delivery address.');
            return;
        }
        if (selectedPaymentUid === null || selectedPaymentType === null) {
            AppAlert.alert('No Payment Method', 'Please select a payment method.');
            return;
        }
        if (items.length === 0) {
            AppAlert.alert('Empty Cart', 'No valid items to checkout.');
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
    }, [selectedAddressUid, selectedPaymentUid, selectedPaymentType, items, totalAmount]);

    const initiatePayment = useCallback(async (): Promise<void> => {
        if (
            userId === null ||
            selectedAddressUid === null ||
            selectedPaymentUid === null ||
            selectedPaymentType === null
        ) return;

        setPaymentLoading(true);
        try {
            const addressId = addressIdMap[selectedAddressUid];
            if (addressId === undefined) throw new Error('Address not found');

            const normalizedPaymentChannel = String(selectedPaymentType).toLowerCase().trim();
            const stripePaymentMethodId =
                normalizedPaymentChannel === 'card' && selectedPaymentAccountNumber !== null
                    ? getStripePaymentMethodIdFromStoredAccount(selectedPaymentAccountNumber)
                    : null;

            // Build idempotency key - prevents duplicate charges on retry
            const idempotencyKey = `order-${userId}-${Date.now()}`;

            const buildBody = () => ({
                userId: userId,
                addressId,
                paymentChannel: normalizedPaymentChannel,
                stripePaymentMethodId: stripePaymentMethodId ?? undefined,
                totalAmount,
                idempotencyKey,
                customerEmail: currentUser?.email ?? '',
                items: items.map((i) => ({
                    uid: i.uid,
                    productName: i.productName,
                    variantName: i.variantName,
                    price: i.price,
                    quantity: i.quantity,
                    productId: i.productId,
                    variantId: i.variantId,
                })),
            });

            // Refresh the session before calling the edge function — getSession() may return
            // a cached, expired access token which causes the gateway to reject with 401.
            // refreshSession() exchanges the refresh token for a guaranteed-fresh access token.
            const { data: refreshedSessionData, error: sessionRefreshError } = await supabase.auth.refreshSession();
            if (sessionRefreshError !== null || refreshedSessionData.session === null) {
                throw new Error('Session expired. Please sign in again to continue checkout.');
            }
            const accessToken = refreshedSessionData.session.access_token;

            // Call Supabase Edge Function with the fresh access token
            const { data: fnData, error: fnError } = await supabase.functions.invoke(
                'payment-create',
                {
                    body: buildBody(),
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );
            if (fnError !== null) {
                throw fnError;
            }

            console.log("Raw Edge Function Response Data:", typeof fnData, fnData);

            let responseData: unknown = fnData;
            if (typeof fnData === 'string') {
                try {
                    responseData = JSON.parse(fnData);
                } catch {
                    // Ignore, keep as string
                }
            }

            const response = responseData as {
                clientSecret?: string;
                paymentIntentId?: string;
                orderId?: string;
                transactionId?: string;
                error?: string;
            } | null;

            if (response?.error) {
                throw new Error(`Edge Function Error: ${response.error}`);
            }

            if (!response || !response.clientSecret) {
                console.error("Invalid response body:", response);
                throw new Error(`Invalid payment response. Please try again.`);
            }

            // WARNING: On Android, immediately opening the Stripe modal after closing another modal
            // can cause the UI to hang. We add a small delay to ensure transitions are finished.
            await new Promise(resolve => setTimeout(resolve, 500));

            // Handle Stripe confirm based on type
            let stripeResponse;
            if (normalizedPaymentChannel === 'card') {
                const pmId = stripePaymentMethodId ?? undefined;
                
                if (pmId) {
                    stripeResponse = await confirmPayment(response.clientSecret, {
                        paymentMethodType: 'Card',
                        paymentMethodData: { paymentMethodId: pmId },
                    });
                } else {
                    stripeResponse = await confirmPayment(response.clientSecret, {
                        paymentMethodType: 'Card',
                    });
                }
            } else {
                // For non-card channels, the PaymentIntent already includes the allowed
                // payment method type from the server-side `payment-create` function.
                stripeResponse = await confirmPayment(response.clientSecret);
            }

            if (!stripeResponse) {
                throw new Error("No response from payment gateway.");
            }

            if (stripeResponse.error) {
                let errorMessage = stripeResponse.error.message || "Payment failed.";
                const errCode = stripeResponse.error.code?.toString() ?? '';
                const errDecline = (stripeResponse.error as { declineCode?: string | null }).declineCode?.toString() ?? '';
                const errMessage = errorMessage.toLowerCase();

                if (errDecline === 'card_declined' || errMessage.includes('card was declined') || errCode.includes('card_declined')) {
                    errorMessage = "Your card was declined. Please try a different card.";
                } else if (errDecline === 'insufficient_funds' || errMessage.includes('insufficient funds') || errCode.includes('insufficient_funds')) {
                    errorMessage = "Insufficient funds. Please try a different card.";
                } else if (errDecline === 'expired_card' || errMessage.includes('expired') || errCode.includes('expired_card')) {
                    errorMessage = "This card has expired. Please update your card details.";
                } else if (errDecline === 'incorrect_cvc' || errMessage.includes('security code') || errCode.includes('incorrect_cvc')) {
                    errorMessage = "Incorrect security code. Please try again.";
                } else if (errMessage.includes('previously used') || errMessage.includes('without customer attachment')) {
                    errorMessage = '__CARD_BURNED__';
                }
                throw new Error(errorMessage);
            }

            // Navigate to order confirmation
            router.push({
                pathname: '/home/order-confirmation' as string,
                params: {
                    orderId: response.orderId,
                    transactionId: response.transactionId,
                    cartUids: cartUids ?? '',
                    status: 'success'
                },
            } as Parameters<typeof router.push>[0]);
        } catch (error) {
            console.error('Payment Error:', error);

            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const errorStatus = (error as { context?: { status?: number } })?.context?.status;
            const errorLower = errorMessage.toLowerCase();

            if (errorStatus === 401 || errorLower.includes('session expired')) {
                AppAlert.alert(
                    'Session Expired',
                    'Please sign in again to continue checkout.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Sign In',
                            onPress: (): void => {
                                router.replace('/auth/login' as Parameters<typeof router.replace>[0]);
                            },
                        },
                    ],
                );
                return;
            }

            // Stripe PM was used once without Customer attachment and is now single-use.
            // The user must delete this saved card and add it again.
            if (
                errorMessage === '__CARD_BURNED__' ||
                errorLower.includes('previously used') ||
                errorLower.includes('without customer attachment')
            ) {
                AppAlert.alert(
                    'Card Cannot Be Reused',
                    'This saved card was previously charged without account linking and can no longer be reused. Please go to Payment Methods, remove it, and add it again.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Payment Methods',
                            onPress: (): void => {
                                router.push('/home/payments' as Parameters<typeof router.push>[0]);
                            },
                        },
                    ],
                );
                return;
            }

            AppAlert.alert(
                'Payment Failed',
                `Unable to initiate payment: ${errorMessage}`,
            );
        } finally {
            setPaymentLoading(false);
        }
    }, [
        userId,
        currentUser,
        selectedAddressUid,
        selectedPaymentUid,
        selectedPaymentType,
        totalAmount,
        items,
        addressIdMap,
        cartUids,
    ]);

    // ─── Render ───────────────────────────────────────────────────────────

    const canProceed =
        selectedAddressUid !== null &&
        selectedPaymentUid !== null &&
        items.length > 0 &&
        !paymentLoading;

    return (
        <SafeScreen style={styles.root}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <RipplePressable onPress={() => router.back()} id="back-btn" style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.primary }]}>‹ Back</Text>
                </RipplePressable>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Checkout</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {isLoading ? (
                    <View style={styles.checkoutSkeletonWrap}>
                        <View style={styles.section}>
                            <SkeletonLoader width={120} height={12} style={styles.skeletonGap} />
                            <SkeletonLoader width="100%" height={72} borderRadius={12} />
                        </View>

                        <View style={styles.section}>
                            <SkeletonLoader width={110} height={12} style={styles.skeletonGap} />
                            <View style={[styles.itemsCard, { backgroundColor: theme.cardBackground }]}> 
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <View key={`checkout-item-skeleton-${index}`} style={styles.checkoutItemSkeletonRow}>
                                        <SkeletonLoader width={64} height={64} borderRadius={8} />
                                        <View style={styles.checkoutItemSkeletonBody}>
                                            <SkeletonLoader width="72%" height={13} style={styles.skeletonGapSmall} />
                                            <SkeletonLoader width="48%" height={12} style={styles.skeletonGapSmall} />
                                            <SkeletonLoader width="34%" height={12} />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.section}>
                            <SkeletonLoader width={132} height={12} style={styles.skeletonGap} />
                            <SkeletonLoader width="100%" height={84} borderRadius={12} />
                        </View>

                        <View style={[styles.section, styles.summaryCard, { backgroundColor: theme.cardBackground }]}> 
                            <SkeletonLoader width={96} height={12} style={styles.skeletonGap} />
                            <SkeletonLoader width="100%" height={14} style={styles.skeletonGapSmall} />
                            <SkeletonLoader width="100%" height={14} style={styles.skeletonGapSmall} />
                            <SkeletonLoader width="70%" height={18} />
                        </View>
                    </View>
                ) : (
                    <>
                        {/* Validation warnings */}
                        {validationWarnings.map((w, i) => (
                            <View key={i} style={[styles.warningBanner, { backgroundColor: `${theme.warning}1A` }]}>
                                <Text style={[styles.warningText, { color: theme.warning }]}>⚠️ {w}</Text>
                            </View>
                        ))}

                        {/* Delivery address section */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Delivery Address</Text>
                            <AddressDropdown
                                addresses={addresses}
                                selectedUid={selectedAddressUid}
                                onSelect={setSelectedAddressUid}
                                onAddAddress={() =>
                                    router.push('/home/addresses' as Parameters<typeof router.push>[0])
                                }
                            />
                            {addresses.length === 0 && (
                                <RipplePressable
                                    style={[styles.addAddressBtn, { borderColor: theme.primary }]}
                                    onPress={() =>
                                        router.push('/home/addresses' as Parameters<typeof router.push>[0])
                                    }
                                    id="add-address-from-checkout"
                                >
                                    <Text style={[styles.addAddressText, { color: theme.primary }]}>+ Add Delivery Address</Text>
                                </RipplePressable>
                            )}
                        </View>

                        {/* Order items */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Order Items ({items.length})</Text>
                            <View style={[styles.itemsCard, { backgroundColor: theme.cardBackground }]}> 
                                {items.map((item) => (
                                    <CheckoutItem key={item.uid} item={item} />
                                ))}
                                {items.length === 0 && (
                                    <Text style={[styles.noItems, { color: theme.textSecondary }]}>No valid items to checkout.</Text>
                                )}
                            </View>
                        </View>

                        {/* Payment method */}
                        <View style={styles.section}>
                            {userId !== null && (
                                <PaymentMethodSelector
                                    userId={userId}
                                    selectedMethodUid={selectedPaymentUid}
                                    onSelect={(uid, type, accountNumber) => {
                                        setSelectedPaymentUid(uid);
                                        setSelectedPaymentType(type as PaymentMethodType);
                                        setSelectedPaymentAccountNumber(accountNumber);
                                    }}
                                    onAddNew={() =>
                                        router.push('/home/payments?returnTo=checkout' as Parameters<typeof router.push>[0])
                                    }
                                    onEmpty={() => setNoMethodsDialogVisible(true)}
                                />
                            )}
                        </View>

                        {/* Price breakdown */}
                        <View style={[styles.section, styles.summaryCard, { backgroundColor: theme.cardBackground }]}> 
                            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Order Summary</Text>
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</Text>
                                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{formatPrice(totalAmount)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Shipping</Text>
                                <Text style={[styles.shippingFree, { color: theme.success }]}>Free</Text>
                            </View>
                            <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: theme.border }]}> 
                                <Text style={[styles.totalLabel, { color: theme.textPrimary }]}>Total</Text>
                                <Text style={[styles.totalValue, { color: theme.primary }]}>{formatPrice(totalAmount)}</Text>
                            </View>
                        </View>

                        {/* Stripe disclaimer */}
                        <Text style={[styles.disclaimer, { color: theme.gray }]}> 
                            🔒 Payments (e-wallets and cards) are processed securely via Stripe. Your card numbers are never stored on our servers.
                        </Text>
                    </>
                )}
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
                message={selectedPaymentType === 'card' ? "Processing card payment…" : "Connecting to payment gateway…"}
            />

            {/* No Methods dialog */}
            <ConfirmDialog
                visible={noMethodsDialogVisible}
                title="No Payment Methods"
                message="You have no saved payment methods. Add one now to continue?"
                onConfirm={() => {
                    setNoMethodsDialogVisible(false);
                    router.push('/home/payments?returnTo=checkout' as Parameters<typeof router.push>[0]);
                }}
                onCancel={() => setNoMethodsDialogVisible(false)}
                confirmLabel="Add Method"
                cancelLabel="Cancel"
                variant="info"
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
    },
    backBtn: { padding: 4, minWidth: 60 },
    backText: { fontSize: 17, fontWeight: '600' },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
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
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    itemsCard: {
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
        fontSize: 14,
    },
    addAddressBtn: {
        marginTop: 10,
        padding: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    addAddressText: {
        fontWeight: '700',
        fontSize: 14,
    },
    warningBanner: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
    },
    warningText: {
        fontSize: 13,
        fontWeight: '500',
    },
    summaryCard: {
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
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    shippingFree: {
        fontSize: 14,
        fontWeight: '600',
    },
    summaryTotal: {
        borderTopWidth: 1,
        paddingTop: 10,
        marginTop: 4,
        marginBottom: 0,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '800',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '900',
    },
    disclaimer: {
        marginHorizontal: 16,
        marginTop: 16,
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
    checkoutSkeletonWrap: {
        paddingTop: 4,
    },
    skeletonGap: {
        marginBottom: 10,
    },
    skeletonGapSmall: {
        marginBottom: 8,
    },
    checkoutItemSkeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    checkoutItemSkeletonBody: {
        flex: 1,
        marginLeft: 12,
    },
});
