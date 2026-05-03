import { RipplePressable } from '@/components/ui/ripple-pressable';
import { MaterialIcons } from '@expo/vector-icons';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useBuyerCredits } from '../../hooks/use-refunds';
import { supabase } from '../../supabase/supabaseClient';
import { formatPrice } from '../../utils/utils';

interface BuyerCreditTransactionRow {
    readonly uid: string;
    readonly transaction_type: string;
    readonly amount: number;
    readonly note: string | null;
    readonly created_at: string;
}

interface WalletTransactionItem {
    readonly uid: string;
    readonly type: 'refund_credit' | 'spend_credit' | 'adjustment';
    readonly amount: number;
    readonly note: string;
    readonly createdAt: string;
}

function normalizeTransactionType(rawType: string): WalletTransactionItem['type'] {
    const normalizedType = rawType.trim().toLowerCase();

    if (normalizedType === 'spend_credit') {
        return 'spend_credit';
    }

    if (normalizedType === 'adjustment') {
        return 'adjustment';
    }

    return 'refund_credit';
}

function toTransactionLabel(type: WalletTransactionItem['type']): string {
    if (type === 'refund_credit') {
        return 'Refund Credit';
    }

    if (type === 'spend_credit') {
        return 'Credit Spent';
    }

    return 'Adjustment';
}

async function fetchBuyerCreditTransactions(userId: number): Promise<readonly WalletTransactionItem[]> {
    const { data, error } = await supabase
        .from('buyer_credit_transactions')
        .select('uid, transaction_type, amount, note, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error !== null) {
        throw new Error(error.message);
    }

    const rows = (data ?? []) as BuyerCreditTransactionRow[];

    return rows.map((row) => ({
        uid: row.uid,
        type: normalizeTransactionType(row.transaction_type),
        amount: row.amount,
        note: row.note ?? '',
        createdAt: row.created_at,
    }));
}

export default function WalletScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { data: currentUser } = useCurrentUser();
    const userId = currentUser?.id ?? null;

    const { data: credits = 0, isLoading: isCreditsLoading, refetch: refetchCredits } = useBuyerCredits(userId);

    const {
        data: transactions = [],
        isLoading: isTransactionsLoading,
        isRefetching,
        refetch: refetchTransactions,
    }: UseQueryResult<readonly WalletTransactionItem[], Error> = useQuery<readonly WalletTransactionItem[], Error>({
        queryKey: ['buyer-credit-transactions', userId ?? 0],
        queryFn: () => fetchBuyerCreditTransactions(userId ?? 0),
        enabled: userId !== null,
        staleTime: 20 * 1000,
    });

    const isLoading = isCreditsLoading || isTransactionsLoading;

    const handleRefresh = async (): Promise<void> => {
        await Promise.all([refetchCredits(), refetchTransactions()]);
    };

    const totalIn = useMemo(() => transactions
        .filter((item) => item.type === 'refund_credit' || item.type === 'adjustment')
        .reduce((sum, item) => sum + item.amount, 0), [transactions]);

    const totalOut = useMemo(() => transactions
        .filter((item) => item.type === 'spend_credit')
        .reduce((sum, item) => sum + item.amount, 0), [transactions]);

    return (
        <SafeScreen style={styles.container}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <RipplePressable style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={20} color={theme.primary} />
                </RipplePressable>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Wallet</Text>
                <View style={styles.headerSpacer} />
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <SkeletonLoader width="100%" height={124} borderRadius={16} style={styles.loadingGap} />
                    <SkeletonLoader width="100%" height={88} borderRadius={14} style={styles.loadingGap} />
                    <SkeletonLoader width="100%" height={88} borderRadius={14} />
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    keyExtractor={(item) => item.uid}
                    contentContainerStyle={styles.contentContainer}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={() => { void handleRefresh(); }}
                            tintColor={theme.primary}
                        />
                    }
                    ListHeaderComponent={
                        <>
                            <View style={[styles.balanceCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                                <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>Available Balance</Text>
                                <Text style={[styles.balanceAmount, { color: theme.primary }]}>{formatPrice(credits)}</Text>
                                <View style={styles.balanceMetricsRow}>
                                    <View style={[styles.metricPill, { backgroundColor: `${theme.success}18` }]}> 
                                        <Text style={[styles.metricPillText, { color: theme.success }]}>In: {formatPrice(totalIn)}</Text>
                                    </View>
                                    <View style={[styles.metricPill, { backgroundColor: `${theme.error}18` }]}> 
                                        <Text style={[styles.metricPillText, { color: theme.error }]}>Out: {formatPrice(totalOut)}</Text>
                                    </View>
                                </View>
                            </View>

                            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Wallet Activity</Text>
                        </>
                    }
                    renderItem={({ item }) => {
                        const isCreditIn = item.type === 'refund_credit' || item.type === 'adjustment';
                        const rowColor = isCreditIn ? theme.success : theme.error;
                        const signedAmount = `${isCreditIn ? '+' : '-'}${formatPrice(item.amount)}`;

                        return (
                            <View style={[styles.transactionCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                                <View style={styles.transactionHeaderRow}>
                                    <Text style={[styles.transactionType, { color: theme.textPrimary }]}>{toTransactionLabel(item.type)}</Text>
                                    <Text style={[styles.transactionAmount, { color: rowColor }]}>{signedAmount}</Text>
                                </View>

                                {item.note.length > 0 && (
                                    <Text style={[styles.transactionNote, { color: theme.textSecondary }]} numberOfLines={2}>
                                        {item.note}
                                    </Text>
                                )}

                                <Text style={[styles.transactionDate, { color: theme.textSecondary }]}>
                                    {new Date(item.createdAt).toLocaleString()}
                                </Text>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <EmptyList
                            icon={<MaterialIcons name="account-balance-wallet" size={48} color={theme.textSecondary} />}
                            message="No wallet activity"
                            submessage="Your refund credits and spending will appear here."
                        />
                    }
                />
            )}
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    backButton: {
        padding: 6,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 30,
    },
    loadingContainer: {
        padding: 16,
    },
    loadingGap: {
        marginBottom: 12,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    balanceCard: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    balanceLabel: {
        fontSize: 13,
        marginBottom: 4,
    },
    balanceAmount: {
        fontSize: 30,
        fontWeight: '800',
        marginBottom: 12,
    },
    balanceMetricsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    metricPill: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
    },
    metricPillText: {
        fontSize: 12,
        fontWeight: '700',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 10,
    },
    transactionCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    transactionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    transactionType: {
        fontSize: 14,
        fontWeight: '700',
    },
    transactionAmount: {
        fontSize: 14,
        fontWeight: '700',
    },
    transactionNote: {
        fontSize: 12,
        marginBottom: 6,
    },
    transactionDate: {
        fontSize: 11,
    },
});
