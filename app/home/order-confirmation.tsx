import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    AppState,
    AppStateStatus,
    BackHandler,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LoadingModal } from '../../components/ui/loading-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { supabase } from '../../supabase/supabaseClient';
import { formatPrice } from '../../utils/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = 'awaiting' | 'checking' | 'success' | 'failed';

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_POLL_INTERVAL_MS: number = 2000;
const MAX_POLL_INTERVAL_MS: number = 10000;
const MAX_POLL_ATTEMPTS: number = 15;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * OrderConfirmationScreen — intermediary between checkout and final success.
 * In Stripe native integration, the SDK handles the URL redirect,
 * and we land here with `status=success` or `status=failed`.
 * If polling is needed, it checks `transaction_history` status.
 * On success: clears cart and shows success UI.
 *
 * @param orderId - Created order UID
 * @param transactionId - Transaction UID for polling
 * @param cartUids - Comma-separated cart item UIDs to clear on success
 * @param status - Payment status 
 */
export default function OrderConfirmationScreen(): React.JSX.Element {
    const { paymentUrl, orderId, transactionId, cartUids, status } =
        useLocalSearchParams<{
            paymentUrl?: string;
            orderId?: string;
            transactionId?: string;
            cartUids?: string;
            status?: string;
        }>();
    const { theme } = useTheme();

    const [pageState, setPageState] = useState<PageState>(() => {
        // If we came here FROM a deep link redirect, we might already have the result
        if (status === 'success') return 'success';
        if (status === 'failed') return 'failed';
        return 'awaiting';
    });
    const [orderTotal, setOrderTotal] = useState<number>(0);
    const [pollAttempt, setPollAttempt] = useState<number>(0);
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const delayRef = useRef<number>(INITIAL_POLL_INTERVAL_MS);

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
        // Automatically open the URL on mount ONLY if we are starting fresh (awaiting)
        // AND we have a valid paymentUrl.
        // If we are already in 'success' or 'failed' state (from deep link), skip this.
        if (pageState === 'awaiting' && paymentUrl && paymentUrl.length > 0) {
            void openPaymentUrl();
        }
    }, [openPaymentUrl, pageState, paymentUrl]);

    // ─── Load order detail for success screen ─────────────────────────────

    const loadOrderTotal = useCallback(async (): Promise<void> => {
        const oid = orderId;

        if (oid === undefined || oid.length === 0) return;
        const { data } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('uid', oid)
            .single();
        if (data !== null) setOrderTotal(data.total_amount);
    }, [orderId]);

    // ─── Clear cart on success ─────────────────────────────────────────────

    const clearCart = useCallback(async (): Promise<void> => {
        const cuids = cartUids;
        if (cuids === undefined || cuids.trim().length === 0) return;
        const uids = cuids.split(',').filter((u) => u.trim().length > 0);
        await supabase.from('cart_items').delete().in('uid', uids);
    }, [cartUids]);

    useEffect(() => {
        if (pageState === 'success' || status === 'success') {
            void loadOrderTotal();
            void clearCart();
        }
    }, [pageState, status, loadOrderTotal, clearCart]);

    // ─── Poll transaction status ───────────────────────────────────────────

    const stopPolling = useCallback((): void => {
        if (pollRef.current !== null) {
            clearTimeout(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const checkStatus = useCallback(async (): Promise<void> => {
        const tid = transactionId;
        if (tid === undefined || tid.length === 0) {
            stopPolling();
            return;
        }

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
            .eq('uid', tid)
            .single();

        if (data === null) {
            // Retry on null gracefully
            delayRef.current = Math.min(delayRef.current * 1.5, MAX_POLL_INTERVAL_MS);
            pollRef.current = setTimeout(() => { void checkStatus(); }, delayRef.current);
            return;
        }

        if (data.status === 'success') {
            stopPolling();
            await clearCart();
            await loadOrderTotal();
            setPageState('success');
        } else if (data.status === 'failed') {
            stopPolling();
            setPageState('failed');
        } else {
            // 'pending' — continue polling with backoff
            delayRef.current = Math.min(delayRef.current * 1.5, MAX_POLL_INTERVAL_MS);
            pollRef.current = setTimeout(() => { void checkStatus(); }, delayRef.current);
        }
    }, [transactionId, stopPolling, clearCart, loadOrderTotal]);

    const startPolling = useCallback((): void => {
        setPageState('checking');
        if (pollRef.current !== null) return;
        delayRef.current = INITIAL_POLL_INTERVAL_MS;
        // Trigger first check immediately if we are starting a fresh poll
        void checkStatus();
    }, [checkStatus]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    // ── Block/guard hardware back press during payment ─────────────────────────
    // During 'checking': block entirely (polling in progress, back would leave inconsistent state)
    // During 'awaiting': prompt the user to confirm cancellation
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (pageState === 'checking') {
                // Swallow — payment verification is in flight
                return true;
            }
            if (pageState === 'awaiting') {
                Alert.alert(
                    'Cancel Payment',
                    'Are you sure you want to cancel this payment?',
                    [
                        { text: 'Continue Payment', style: 'cancel' },
                        { text: 'Cancel & Go Back', style: 'destructive', onPress: () => router.back() },
                    ],
                );
                return true;
            }
            return false;
        });
        return () => subscription.remove();
    }, [pageState]);

    // ─── AppState listener for background return ──────────────────────────

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && pageState === 'awaiting') {
                // User came back to the app, check status automatically and show spinner
                void startPolling();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [pageState, checkStatus]);

    // ─── Render: awaiting user action ─────────────────────────────────────

    if (pageState === 'awaiting') {
        return (
            <SafeScreen style={styles.root}>
                <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
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
                        <Text style={[styles.cancelBtnText, { color: theme.error }]}>✕ Cancel</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Payment</Text>
                    <View style={{ width: 80 }} />
                </View>

                <ScrollView contentContainerStyle={styles.awaitingContent}>
                    <Text style={styles.awaitingEmoji}>🔒</Text>
                    <Text style={[styles.awaitingTitle, { color: theme.textPrimary }]}>Complete Your Payment</Text>
                    <Text style={[styles.awaitingSubtitle, { color: theme.textSecondary }]}>
                        A payment page has been opened in your browser. Complete
                        the payment there, then return here to confirm your order.
                    </Text>

                    <View style={[styles.stepCard, { backgroundColor: theme.cardBackground }]}>
                        <View style={styles.step}>
                            <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}><Text style={[styles.stepNumberText, { color: theme.white }]}>1</Text></View>
                            <Text style={[styles.stepText, { color: theme.textPrimary }]}>Complete payment in browser/app</Text>
                        </View>
                        <View style={styles.step}>
                            <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}><Text style={[styles.stepNumberText, { color: theme.white }]}>2</Text></View>
                            <Text style={[styles.stepText, { color: theme.textPrimary }]}>Return to this screen</Text>
                        </View>
                        <View style={styles.step}>
                            <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}><Text style={[styles.stepNumberText, { color: theme.white }]}>3</Text></View>
                            <Text style={[styles.stepText, { color: theme.textPrimary }]}>Tap "I've Paid" to confirm</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.paidBtn, { backgroundColor: theme.primary }]}
                        onPress={startPolling}
                        id="ive-paid-button"
                    >
                        <Text style={[styles.paidBtnText, { color: theme.white }]}>I've Paid ✓</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.reopenBtn, { borderColor: theme.border }]}
                        onPress={() => { void openPaymentUrl(); }}
                        id="reopen-payment-url"
                    >
                        <Text style={[styles.reopenBtnText, { color: theme.textSecondary }]}>↗ Open Payment Page Again</Text>
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
                    <Text style={[styles.outcomeTitle, { color: theme.textPrimary }]}>Order Placed!</Text>
                    <Text style={[styles.outcomeSubtitle, { color: theme.textSecondary }]}>
                        Your payment of {formatPrice(orderTotal)} was successful.
                    </Text>
                    <Text style={[styles.outcomeDetail, { color: theme.gray }]}>
                        You'll receive a confirmation email shortly. Track your order in My Orders.
                    </Text>

                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                        onPress={() =>
                            router.replace('/home/catalog' as Parameters<typeof router.replace>[0])
                        }
                        id="go-to-catalog"
                    >
                        <Text style={[styles.primaryBtnText, { color: theme.white }]}>Continue Shopping</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: theme.border }]}
                        onPress={() =>
                            router.push('/home/catalog' as Parameters<typeof router.push>[0])
                        }
                        id="view-orders"
                    >
                        <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>View My Orders</Text>
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
                <Text style={[styles.outcomeTitle, { color: theme.textPrimary }]}>Payment Failed</Text>
                <Text style={[styles.outcomeSubtitle, { color: theme.textSecondary }]}>
                    Your payment could not be processed. You have not been charged.
                </Text>
                <Text style={[styles.outcomeDetail, { color: theme.gray }]}>
                    Please check your payment details and try again. If the problem persists, contact support.
                </Text>

                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                    onPress={() => router.back()}
                    id="retry-payment"
                >
                    <Text style={[styles.primaryBtnText, { color: theme.white }]}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: theme.border }]}
                    onPress={() =>
                        router.replace('/home/catalog' as Parameters<typeof router.replace>[0])
                    }
                    id="go-to-catalog-failed"
                >
                    <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>Go to Catalog</Text>
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
    },
    cancelBtn: { padding: 4, minWidth: 80 },
    cancelBtnText: { fontSize: 14, fontWeight: '700' },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
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
        marginBottom: 12,
        textAlign: 'center',
    },
    awaitingSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    stepCard: {
        width: '100%',
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepNumberText: {
        fontWeight: '900',
        fontSize: 14,
    },
    stepText: {
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
    paidBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    paidBtnText: {
        fontWeight: '800',
        fontSize: 17,
    },
    reopenBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    reopenBtnText: {
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
        marginBottom: 10,
        textAlign: 'center',
    },
    outcomeSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 10,
    },
    outcomeDetail: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 40,
    },
    primaryBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryBtnText: {
        fontWeight: '800',
        fontSize: 16,
    },
    secondaryBtn: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        alignItems: 'center',
    },
    secondaryBtnText: {
        fontWeight: '700',
        fontSize: 15,
    },
});
