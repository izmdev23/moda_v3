import * as Linking from 'expo-linking';
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
import { LoadingModal } from '../../components/ui/loading-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { supabase } from '../../supabase/supabaseClient';
import { lightPalette } from '../../utils/theme';
import { formatPrice } from '../../utils/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = 'awaiting' | 'checking' | 'success' | 'failed';

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS: number = 3000;
const MAX_POLL_ATTEMPTS: number = 20; // 20 × 3s = 60s timeout

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * OrderConfirmationScreen — intermediary between checkout and final success.
 * Opens the Xendit payment URL via Linking.openURL (external browser/app),
 * then polls the transaction_history status until success or failure.
 * On success: clears cart and shows success UI.
 *
 * @param paymentUrl - Xendit payment URL returned by payment-create edge function
 * @param orderId - Created order UID
 * @param transactionId - Transaction UID for polling
 * @param cartUids - Comma-separated cart item UIDs to clear on success
 */
export default function OrderConfirmationScreen(): React.JSX.Element {
    const { paymentUrl, orderId, transactionId, cartUids } =
        useLocalSearchParams<{
            paymentUrl: string;
            orderId: string;
            transactionId: string;
            cartUids: string;
        }>();

    const [pageState, setPageState] = useState<PageState>('awaiting');
    const [orderTotal, setOrderTotal] = useState<number>(0);
    const [pollAttempt, setPollAttempt] = useState<number>(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Open payment URL in external browser ─────────────────────────────

    const openPaymentUrl = useCallback(async (): Promise<void> => {
        if (paymentUrl === undefined || paymentUrl.length === 0) {
            Alert.alert('Error', 'No payment URL available.');
            return;
        }
        try {
            await Linking.openURL(paymentUrl);
        } catch {
            Alert.alert('Error', 'Unable to open payment page. Please try again.');
        }
    }, [paymentUrl]);

    useEffect(() => {
        // Automatically open the URL on mount
        void openPaymentUrl();
    }, [openPaymentUrl]);

    // ─── Load order detail for success screen ─────────────────────────────

    const loadOrderTotal = useCallback(async (): Promise<void> => {
        if (orderId === undefined || orderId.length === 0) return;
        const { data } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('uid', orderId)
            .single();
        if (data !== null) setOrderTotal(data.total_amount);
    }, [orderId]);

    // ─── Clear cart on success ─────────────────────────────────────────────

    const clearCart = useCallback(async (): Promise<void> => {
        if (cartUids === undefined || cartUids.trim().length === 0) return;
        const uids = cartUids.split(',').filter((u) => u.trim().length > 0);
        await supabase.from('cart_items').delete().in('uid', uids);
    }, [cartUids]);

    // ─── Poll transaction status ───────────────────────────────────────────

    const stopPolling = useCallback((): void => {
        if (pollRef.current !== null) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const checkStatus = useCallback(async (): Promise<void> => {
        if (transactionId === undefined || transactionId.length === 0) return;

        setPollAttempt((prev) => {
            if (prev >= MAX_POLL_ATTEMPTS) {
                stopPolling();
                setPageState('failed');
                return prev;
            }
            return prev + 1;
        });

        const { data } = await supabase
            .from('transaction_history')
            .select('status')
            .eq('uid', transactionId)
            .single();

        if (data === null) return;

        if (data.status === 'success') {
            stopPolling();
            await clearCart();
            await loadOrderTotal();
            setPageState('success');
        } else if (data.status === 'failed') {
            stopPolling();
            setPageState('failed');
        }
        // 'pending' — continue polling
    }, [transactionId, stopPolling, clearCart, loadOrderTotal]);

    const startPolling = useCallback((): void => {
        if (pollRef.current !== null) return;
        setPageState('checking');
        pollRef.current = setInterval(() => {
            void checkStatus();
        }, POLL_INTERVAL_MS);
    }, [checkStatus]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    // ─── Render: awaiting user action ─────────────────────────────────────

    if (pageState === 'awaiting') {
        return (
            <SafeScreen style={styles.root}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            Alert.alert(
                                'Cancel Payment',
                                'Are you sure you want to cancel this payment?',
                                [
                                    { text: 'Continue Payment', style: 'cancel' },
                                    {
                                        text: 'Cancel & Go Back',
                                        style: 'destructive',
                                        onPress: () => router.back(),
                                    },
                                ],
                            );
                        }}
                        style={styles.cancelBtn}
                        id="cancel-payment"
                    >
                        <Text style={styles.cancelBtnText}>✕ Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Payment</Text>
                    <View style={{ width: 80 }} />
                </View>

                <ScrollView contentContainerStyle={styles.awaitingContent}>
                    <Text style={styles.awaitingEmoji}>🔒</Text>
                    <Text style={styles.awaitingTitle}>Complete Your Payment</Text>
                    <Text style={styles.awaitingSubtitle}>
                        A payment page has been opened in your browser. Complete
                        the payment there, then return here to confirm your order.
                    </Text>

                    <View style={styles.stepCard}>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                            <Text style={styles.stepText}>Complete payment in browser/app</Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                            <Text style={styles.stepText}>Return to this screen</Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                            <Text style={styles.stepText}>Tap "I've Paid" to confirm</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.paidBtn}
                        onPress={startPolling}
                        id="ive-paid-button"
                    >
                        <Text style={styles.paidBtnText}>I've Paid ✓</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.reopenBtn}
                        onPress={() => { void openPaymentUrl(); }}
                        id="reopen-payment-url"
                    >
                        <Text style={styles.reopenBtnText}>↗ Open Payment Page Again</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeScreen>
        );
    }

    // ─── Render: checking/polling ──────────────────────────────────────────

    if (pageState === 'checking') {
        return (
            <SafeScreen>
                <LoadingModal
                    isVisible
                    message={`Verifying payment…\nAttempt ${pollAttempt} of ${MAX_POLL_ATTEMPTS}`}
                />
            </SafeScreen>
        );
    }

    // ─── Render: success ───────────────────────────────────────────────────

    if (pageState === 'success') {
        return (
            <SafeScreen style={styles.root}>
                <ScrollView contentContainerStyle={styles.outcomeContainer}>
                    <Text style={styles.successEmoji}>🎉</Text>
                    <Text style={styles.outcomeTitle}>Order Placed!</Text>
                    <Text style={styles.outcomeSubtitle}>
                        Your payment of {formatPrice(orderTotal)} was successful.
                    </Text>
                    <Text style={styles.outcomeDetail}>
                        You'll receive a confirmation email shortly. Track your order in My Orders.
                    </Text>

                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() =>
                            router.replace('/home/catalog' as Parameters<typeof router.replace>[0])
                        }
                        id="go-to-catalog"
                    >
                        <Text style={styles.primaryBtnText}>Continue Shopping</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() =>
                            router.push('/home/catalog' as Parameters<typeof router.push>[0])
                        }
                        id="view-orders"
                    >
                        <Text style={styles.secondaryBtnText}>View My Orders</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeScreen>
        );
    }

    // ─── Render: failed ────────────────────────────────────────────────────

    return (
        <SafeScreen style={styles.root}>
            <ScrollView contentContainerStyle={styles.outcomeContainer}>
                <Text style={styles.failEmoji}>❌</Text>
                <Text style={styles.outcomeTitle}>Payment Failed</Text>
                <Text style={styles.outcomeSubtitle}>
                    Your payment could not be processed. You have not been charged.
                </Text>
                <Text style={styles.outcomeDetail}>
                    Please check your payment details and try again. If the problem persists, contact support.
                </Text>

                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => router.back()}
                    id="retry-payment"
                >
                    <Text style={styles.primaryBtnText}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() =>
                        router.replace('/home/catalog' as Parameters<typeof router.replace>[0])
                    }
                    id="go-to-catalog-failed"
                >
                    <Text style={styles.secondaryBtnText}>Go to Catalog</Text>
                </TouchableOpacity>
            </ScrollView>
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
    cancelBtn: { padding: 4, minWidth: 80 },
    cancelBtnText: { fontSize: 14, color: lightPalette.error, fontWeight: '700' },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: lightPalette.textPrimary,
    },

    // Awaiting screen
    awaitingContent: {
        padding: 24,
        alignItems: 'center',
    },
    awaitingEmoji: {
        fontSize: 64,
        marginVertical: 16,
    },
    awaitingTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: lightPalette.textPrimary,
        marginBottom: 12,
        textAlign: 'center',
    },
    awaitingSubtitle: {
        fontSize: 15,
        color: lightPalette.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    stepCard: {
        width: '100%',
        backgroundColor: lightPalette.cardBackground,
        borderRadius: 14,
        padding: 20,
        marginBottom: 28,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        gap: 16,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    stepNumber: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: lightPalette.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepNumberText: {
        color: lightPalette.white,
        fontWeight: '900',
        fontSize: 14,
    },
    stepText: {
        fontSize: 14,
        color: lightPalette.textPrimary,
        flex: 1,
        lineHeight: 20,
    },
    paidBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: lightPalette.primary,
        alignItems: 'center',
        marginBottom: 12,
    },
    paidBtnText: {
        color: lightPalette.white,
        fontWeight: '800',
        fontSize: 17,
    },
    reopenBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: lightPalette.border,
        alignItems: 'center',
    },
    reopenBtnText: {
        color: lightPalette.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },

    // Outcome screens (success / failed)
    outcomeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    successEmoji: { fontSize: 80, marginBottom: 16 },
    failEmoji: { fontSize: 80, marginBottom: 16 },
    outcomeTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: lightPalette.textPrimary,
        marginBottom: 10,
        textAlign: 'center',
    },
    outcomeSubtitle: {
        fontSize: 16,
        color: lightPalette.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 10,
    },
    outcomeDetail: {
        fontSize: 14,
        color: lightPalette.gray,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 40,
    },
    primaryBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: lightPalette.primary,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryBtnText: {
        color: lightPalette.white,
        fontWeight: '800',
        fontSize: 16,
    },
    secondaryBtn: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: lightPalette.border,
        alignItems: 'center',
    },
    secondaryBtnText: {
        color: lightPalette.textPrimary,
        fontWeight: '700',
        fontSize: 15,
    },
});
