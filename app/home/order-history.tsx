import { AppAlert } from '@/utils/app-alert';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
    DateRange,
    DateRangeFilter,
    MultiSelectToolbar,
    TransactionCard,
    TransactionData,
    TransactionDetailModal
} from '../../components/order-history-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { supabase } from '../../supabase/supabaseClient';

interface TransactionHistoryRow {
    readonly uid: string;
    readonly order_id: number;
    readonly amount: number;
    readonly status: string;
    readonly payment_channel: string | null;
    readonly created_at: string;
}

interface OrderItemHistoryRow {
    readonly uid: string;
    readonly order_id: number;
    readonly product_id: number | null;
    readonly product_name: string;
    readonly quantity: number;
    readonly unit_price: number;
    readonly total_price: number;
}

interface ProductThumbnailRow {
    readonly id: number;
    readonly thumbnail_url: string;
}

interface SellerOrderRow {
    readonly id: number;
    readonly created_at: string;
    readonly status: string;
}

interface BuyerOrderRow {
    readonly id: number;
    readonly created_at: string;
    readonly status: string;
}

interface SellerShopRow {
    readonly id: number;
}

const UNKNOWN_PAYMENT_METHOD_LABEL = 'Unknown';
const PLACEHOLDER_THUMBNAIL = '';

function mapTransactionStatus(rawStatus: string): TransactionData['status'] {
    const normalizedStatus = rawStatus.trim().toLowerCase();

    if (normalizedStatus === 'success') {
        return 'completed';
    }

    if (normalizedStatus === 'pending') {
        return 'pending';
    }

    return 'cancelled';
}

function mapSellerOrderStatus(rawStatus: string): TransactionData['status'] {
    const normalizedStatus = rawStatus.trim().toLowerCase();

    if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
        return 'cancelled';
    }

    if (normalizedStatus === 'pending') {
        return 'pending';
    }

    return 'completed';
}

function mapBuyerOrderStatus(rawStatus: string): TransactionData['status'] {
    const normalizedStatus = rawStatus.trim().toLowerCase();

    if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
        return 'cancelled';
    }

    if (normalizedStatus === 'pending') {
        return 'pending';
    }

    return 'completed';
}

function mapPaymentMethodLabel(paymentChannel: string | null): string {
    if (paymentChannel === null) {
        return UNKNOWN_PAYMENT_METHOD_LABEL;
    }

    const normalizedChannel = paymentChannel.trim().toLowerCase();
    if (normalizedChannel === 'gcash') {
        return 'GCash';
    }
    if (normalizedChannel === 'paymaya') {
        return 'PayMaya';
    }
    if (normalizedChannel === 'card') {
        return 'Card';
    }

    if (normalizedChannel.length === 0) {
        return UNKNOWN_PAYMENT_METHOD_LABEL;
    }

    return normalizedChannel[0].toUpperCase() + normalizedChannel.slice(1);
}

function buildTransactionItems(
    orderItems: readonly OrderItemHistoryRow[],
    thumbnailByProductId: ReadonlyMap<number, string>,
): TransactionData['items'] {
    return orderItems.map((item) => ({
        id: item.uid,
        name: item.product_name,
        thumbnail: item.product_id === null
            ? PLACEHOLDER_THUMBNAIL
            : (thumbnailByProductId.get(item.product_id) ?? PLACEHOLDER_THUMBNAIL),
        price: item.unit_price,
        quantity: item.quantity,
    }));
}

function buildItemCount(orderItems: readonly OrderItemHistoryRow[]): number {
    return orderItems.reduce((totalCount, item) => totalCount + item.quantity, 0);
}

function filterTransactionsByDateRange(
    transactions: readonly TransactionData[],
    activeDateRange: DateRange,
): TransactionData[] {
    if (activeDateRange === 'all') {
        return [...transactions];
    }

    const now = new Date();
    const days = activeDateRange === '7d' ? 7 : activeDateRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

    return transactions.filter((transaction) => transaction.createDate >= cutoff);
}

async function fetchBuyerTransactions(userId: number): Promise<TransactionData[]> {
    const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, created_at, status')
        .eq('buyer_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (ordersError !== null) {
        throw new Error(ordersError.message);
    }

    const orders = (ordersData ?? []) as BuyerOrderRow[];
    if (orders.length === 0) {
        return [];
    }

    const orderIds = orders.map((order) => order.id);

    const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('uid, order_id, product_id, product_name, quantity, unit_price, total_price')
        .in('order_id', orderIds);

    if (orderItemsError !== null) {
        throw new Error(orderItemsError.message);
    }

    const orderItems = (orderItemsData ?? []) as OrderItemHistoryRow[];
    if (orderItems.length === 0) {
        return [];
    }

    const orderItemsByOrderId = new Map<number, OrderItemHistoryRow[]>();
    for (const item of orderItems) {
        const existingItems = orderItemsByOrderId.get(item.order_id) ?? [];
        existingItems.push(item);
        orderItemsByOrderId.set(item.order_id, existingItems);
    }

    const productIds = Array.from(
        new Set(orderItems.map((item) => item.product_id).filter((value): value is number => value !== null)),
    );

    const { data: transactionsData, error: transactionsError } = await supabase
        .from('transaction_history')
        .select('uid, order_id, amount, status, payment_channel, created_at')
        .eq('user_id', userId)
        .is('hidden_at', null)
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

    if (transactionsError !== null) {
        throw new Error(transactionsError.message);
    }

    const transactions = (transactionsData ?? []) as TransactionHistoryRow[];
    const transactionByOrderId = new Map<number, TransactionHistoryRow>();
    for (const transaction of transactions) {
        const existingTransaction = transactionByOrderId.get(transaction.order_id);
        if (existingTransaction === undefined) {
            transactionByOrderId.set(transaction.order_id, transaction);
        }
    }

    const productsResult = productIds.length === 0
        ? { data: [] as ProductThumbnailRow[], error: null }
        : await supabase.from('products').select('id, thumbnail_url').in('id', productIds);

    if (productsResult.error !== null) {
        throw new Error(productsResult.error.message);
    }

    const thumbnailByProductId = new Map<number, string>();
    for (const product of (productsResult.data ?? []) as ProductThumbnailRow[]) {
        thumbnailByProductId.set(product.id, product.thumbnail_url);
    }

    return orders
        .map((order) => {
            const transactionItems = orderItemsByOrderId.get(order.id) ?? [];
            if (transactionItems.length === 0) {
                return null;
            }

            const matchingTransaction = transactionByOrderId.get(order.id) ?? null;
            const orderSubtotal = transactionItems.reduce((subtotal, item) => subtotal + item.total_price, 0);

            return {
                id: matchingTransaction?.uid ?? `order-${order.id}`,
                createDate: new Date(matchingTransaction?.created_at ?? order.created_at),
                itemCount: buildItemCount(transactionItems),
                total: matchingTransaction?.amount ?? orderSubtotal,
                paymentMethod: matchingTransaction === null
                    ? UNKNOWN_PAYMENT_METHOD_LABEL
                    : mapPaymentMethodLabel(matchingTransaction.payment_channel),
                status: matchingTransaction === null
                    ? mapBuyerOrderStatus(order.status)
                    : mapTransactionStatus(matchingTransaction.status),
                items: buildTransactionItems(transactionItems, thumbnailByProductId),
            } as TransactionData;
        })
        .filter((transaction): transaction is TransactionData => transaction !== null)
        .sort((left, right) => right.createDate.getTime() - left.createDate.getTime());
}

async function fetchSellerTransactions(userId: number): Promise<TransactionData[]> {
    const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null);

    if (shopsError !== null) {
        throw new Error(shopsError.message);
    }

    const shops = (shopsData ?? []) as SellerShopRow[];
    if (shops.length === 0) {
        return [];
    }

    const shopIds = shops.map((shop) => shop.id);

    const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('uid, order_id, product_id, product_name, quantity, unit_price, total_price, shop_id')
        .in('shop_id', shopIds);

    if (orderItemsError !== null) {
        throw new Error(orderItemsError.message);
    }

    const sellerOrderItems = (orderItemsData ?? []) as OrderItemHistoryRow[];
    if (sellerOrderItems.length === 0) {
        return [];
    }

    const orderIds = Array.from(new Set(sellerOrderItems.map((item) => item.order_id)));

    const ordersPromise = supabase
        .from('orders')
        .select('id, created_at, status')
        .in('id', orderIds);

    const transactionsPromise = supabase
        .from('transaction_history')
        .select('uid, order_id, amount, status, payment_channel, created_at')
        .in('order_id', orderIds)
        .is('hidden_at', null);

    const productIds = Array.from(
        new Set(sellerOrderItems.map((item) => item.product_id).filter((value): value is number => value !== null)),
    );
    const productsPromise = productIds.length === 0
        ? Promise.resolve({ data: [] as ProductThumbnailRow[], error: null })
        : supabase.from('products').select('id, thumbnail_url').in('id', productIds);

    const [ordersResult, transactionsResult, productsResult] = await Promise.all([
        ordersPromise,
        transactionsPromise,
        productsPromise,
    ]);

    if (ordersResult.error !== null) {
        throw new Error(ordersResult.error.message);
    }

    if (productsResult.error !== null) {
        throw new Error(productsResult.error.message);
    }

    const orders = (ordersResult.data ?? []) as SellerOrderRow[];
    const orderById = new Map<number, SellerOrderRow>();
    for (const order of orders) {
        orderById.set(order.id, order);
    }

    const transactions = transactionsResult.error === null
        ? ((transactionsResult.data ?? []) as TransactionHistoryRow[])
        : [];

    const transactionByOrderId = new Map<number, TransactionHistoryRow>();
    for (const transaction of transactions) {
        transactionByOrderId.set(transaction.order_id, transaction);
    }

    const thumbnailByProductId = new Map<number, string>();
    for (const product of (productsResult.data ?? []) as ProductThumbnailRow[]) {
        thumbnailByProductId.set(product.id, product.thumbnail_url);
    }

    const sellerItemsByOrderId = new Map<number, OrderItemHistoryRow[]>();
    for (const item of sellerOrderItems) {
        const existingItems = sellerItemsByOrderId.get(item.order_id) ?? [];
        existingItems.push(item);
        sellerItemsByOrderId.set(item.order_id, existingItems);
    }

    const mappedTransactions: TransactionData[] = [];

    for (const [orderId, orderItems] of sellerItemsByOrderId.entries()) {
        const order = orderById.get(orderId);
        if (order === undefined) {
            continue;
        }

        const matchingTransaction = transactionByOrderId.get(orderId) ?? null;
        const sellerSubtotal = orderItems.reduce((subtotal, item) => subtotal + item.total_price, 0);

        mappedTransactions.push({
            id: matchingTransaction?.uid ?? `order-${orderId}`,
            createDate: new Date(matchingTransaction?.created_at ?? order.created_at),
            itemCount: buildItemCount(orderItems),
            total: sellerSubtotal,
            paymentMethod: matchingTransaction === null
                ? UNKNOWN_PAYMENT_METHOD_LABEL
                : mapPaymentMethodLabel(matchingTransaction.payment_channel),
            status: matchingTransaction === null
                ? mapSellerOrderStatus(order.status)
                : mapTransactionStatus(matchingTransaction.status),
            items: buildTransactionItems(orderItems, thumbnailByProductId),
        });
    }

    return mappedTransactions.sort((left, right) => right.createDate.getTime() - left.createDate.getTime());
}

function OrderHistorySkeleton(): React.JSX.Element {
    return (
        <View style={styles.skeletonWrap}>
            {Array.from({ length: 4 }).map((_, index) => (
                <View key={`transaction-skeleton-${index}`} style={styles.skeletonCard}>
                    <View style={styles.skeletonHeaderRow}>
                        <SkeletonLoader width="36%" height={12} />
                        <SkeletonLoader width={70} height={12} />
                    </View>
                    <View style={styles.skeletonBodyRow}>
                        <SkeletonLoader width={32} height={32} borderRadius={16} />
                        <View style={styles.skeletonBodyTextWrap}>
                            <SkeletonLoader width="42%" height={14} style={styles.skeletonGap} />
                            <SkeletonLoader width="36%" height={12} />
                        </View>
                        <SkeletonLoader width={82} height={16} />
                    </View>
                </View>
            ))}
        </View>
    );
}

export default function OrderHistoryScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

    const [transactions, setTransactions] = useState<TransactionData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [activeDateRange, setActiveDateRange] = useState<DateRange>('all');

    // Selection
    const [selectionMode, setSelectionMode] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set<string>());

    // Modal
    const [selectedTransaction, setSelectedTransaction] = useState<TransactionData | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);

    const [confirmVisible, setConfirmVisible] = useState<boolean>(false);
    const canHideTransactions = currentUser?.role === 'buyer';

    const filteredTransactions = useMemo(
        () => filterTransactionsByDateRange(transactions, activeDateRange),
        [transactions, activeDateRange],
    );

    const loadTransactions = useCallback(async (showLoader: boolean): Promise<void> => {
        if (isUserLoading) {
            return;
        }

        if (showLoader) {
            setIsLoading(true);
        } else {
            setIsRefreshing(true);
        }

        try {
            if (currentUser === null) {
                setTransactions([]);
                return;
            }

            const resolvedTransactions = currentUser.role === 'seller'
                ? await fetchSellerTransactions(currentUser.id)
                : await fetchBuyerTransactions(currentUser.id);

            setTransactions(resolvedTransactions);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load transaction history.';
            AppAlert.alert('Error', message);
            setTransactions([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [currentUser, isUserLoading]);

    useEffect(() => {
        void loadTransactions(true);
    }, [loadTransactions]);

    useFocusEffect(
        useCallback((): void => {
            void loadTransactions(false);
        }, [loadTransactions]),
    );

    // View detail
    const handlePress = useCallback((txn: TransactionData): void => {
        setSelectedTransaction(txn);
        setDetailModalVisible(true);
    }, []);

    // Selection toggle
    const toggleSelection = useCallback((id: string): void => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
        if (newSelection.size === 0) setSelectionMode(false);
        else setSelectionMode(true);
    }, [selectedIds]);

    // Exit selection mode on unmount
    useEffect(() => {
        return (): void => {
            setSelectionMode(false);
            setSelectedIds(new Set<string>());
        };
    }, []);

    const handleDelete = useCallback(async (): Promise<void> => {
        if (!canHideTransactions) {
            AppAlert.alert('Unavailable', 'Hiding transaction history is available for buyer accounts only.');
            setConfirmVisible(false);
            return;
        }

        const selectedUids = Array.from(selectedIds).filter((id) => !id.startsWith('order-'));
        if (selectedUids.length === 0) {
            setTransactions((previousTransactions) => previousTransactions.filter((transaction) => !selectedIds.has(transaction.id)));
            setSelectionMode(false);
            setSelectedIds(new Set<string>());
            setConfirmVisible(false);
            return;
        }

        const { error } = await supabase
            .from('transaction_history')
            .update({ hidden_at: new Date().toISOString() })
            .in('uid', selectedUids);

        if (error !== null) {
            AppAlert.alert('Error', error.message);
            return;
        }

        setTransactions((previousTransactions) => previousTransactions.filter((transaction) => !selectedIds.has(transaction.id)));
        setSelectionMode(false);
        setSelectedIds(new Set<string>());
        setConfirmVisible(false);
    }, [canHideTransactions, selectedIds]);

    const handleDownloadStub = useCallback((): void => {
        AppAlert.alert('Receipt Generated', 'The receipt has been saved to your device.');
    }, []);

    const historyTitle = currentUser?.role === 'seller' ? 'Sales History' : 'Transaction History';
    const emptyMessage = currentUser?.role === 'seller' ? 'No sales found' : 'No purchases found';
    const emptySubmessage = currentUser?.role === 'seller'
        ? 'Completed buyer payments for your shop will appear here.'
        : 'Try changing the date filter or start shopping!';

    return (
        <SafeScreen style={styles.container}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.headerText, { color: theme.textPrimary }]}>{historyTitle}</Text>
            </View>

            {!selectionMode || !canHideTransactions ? (
                <View style={{ height: 60, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.cardBackground }}>
                    <DateRangeFilter
                        activeRange={activeDateRange}
                        onChange={setActiveDateRange}
                    />
                </View>
            ) : (
                <MultiSelectToolbar
                    selectedCount={selectedIds.size}
                    onClear={() => {
                        setSelectionMode(false);
                        setSelectedIds(new Set<string>());
                    }}
                    onSelectAll={() => setSelectedIds(new Set(filteredTransactions.map(t => t.id)))}
                    onDelete={() => setConfirmVisible(true)}
                />
            )}

            {isLoading ? (
                <OrderHistorySkeleton />
            ) : (
                <FlatList
                    data={filteredTransactions}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <TransactionCard
                            transaction={item}
                            isSelected={selectedIds.has(item.id)}
                            selectionMode={canHideTransactions && selectionMode}
                            onSelect={canHideTransactions ? () => toggleSelection(item.id) : undefined}
                            onPress={() => handlePress(item)}
                        />
                    )}
                    ListEmptyComponent={
                        <EmptyList
                            icon="receipt"
                            message={emptyMessage}
                            submessage={emptySubmessage}
                        />
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => {
                                void loadTransactions(false);
                            }}
                            tintColor={theme.primary}
                        />
                    }
                />
            )}

            <TransactionDetailModal
                visible={detailModalVisible}
                transaction={selectedTransaction}
                onClose={() => setDetailModalVisible(false)}
                onDownloadReceipt={handleDownloadStub}
            />

            <ConfirmDialog
                visible={confirmVisible}
                title="Delete Transactions"
                message="Are you sure you want to remove these transactions from your history? They will still remain for your accounting."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => {
                    void handleDelete();
                }}
                onCancel={() => setConfirmVisible(false)}
            />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
    },
    headerText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    listContent: {
        padding: 16,
        paddingBottom: 24,
    },
    skeletonWrap: {
        padding: 16,
        paddingBottom: 24,
    },
    skeletonCard: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
    },
    skeletonHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    skeletonBodyRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    skeletonBodyTextWrap: {
        flex: 1,
        marginHorizontal: 16,
    },
    skeletonGap: {
        marginBottom: 6,
    },
});
