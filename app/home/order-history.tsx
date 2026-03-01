import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
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
import { useTheme } from '../../components/ui/theme-provider';

// Dummy data
const MOCK_TRANSACTIONS: TransactionData[] = [
    {
        id: 'txn_001',
        createDate: new Date(),
        itemCount: 2,
        total: 1250.00,
        paymentMethod: 'GCash',
        status: 'completed',
        items: [
            { id: 'i1', name: 'Vintage Jacket', thumbnail: 'https://picsum.photos/id/21/100', price: 850, quantity: 1 },
            { id: 'i2', name: 'Checkered Shirt', thumbnail: 'https://picsum.photos/id/22/100', price: 400, quantity: 1 }
        ]
    },
    {
        id: 'txn_002',
        createDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
        itemCount: 1,
        total: 350.00,
        paymentMethod: 'PayMaya',
        status: 'completed',
        items: [
            { id: 'i3', name: 'Leather Belt', thumbnail: 'https://picsum.photos/id/23/100', price: 350, quantity: 1 }
        ]
    }
];

export default function OrderHistoryScreen() {
    const { theme } = useTheme();
    const [transactions, setTransactions] = useState<TransactionData[]>(MOCK_TRANSACTIONS);
    const [filteredTransactions, setFilteredTransactions] = useState<TransactionData[]>(MOCK_TRANSACTIONS);
    const [activeDateRange, setActiveDateRange] = useState<DateRange>('all');

    // Selection
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modal
    const [selectedTransaction, setSelectedTransaction] = useState<TransactionData | null>(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);

    const [confirmVisible, setConfirmVisible] = useState(false);

    // Filter effect
    useEffect(() => {
        let filtered = [...transactions];
        const now = new Date();

        if (activeDateRange !== 'all') {
            const days = activeDateRange === '7d' ? 7 : activeDateRange === '30d' ? 30 : 90;
            const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
            filtered = filtered.filter(t => t.createDate >= cutoff);
        }

        setFilteredTransactions(filtered);
    }, [transactions, activeDateRange]);

    // View detail
    const handlePress = (txn: TransactionData) => {
        setSelectedTransaction(txn);
        setDetailModalVisible(true);
    };

    // Selection toggle
    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
        if (newSelection.size === 0) setSelectionMode(false);
        else setSelectionMode(true);
    };

    // Exit selection mode on unmount
    useEffect(() => {
        return () => {
            setSelectionMode(false);
            setSelectedIds(new Set());
        };
    }, []);

    const handleDelete = () => {
        // Perform soft delete implementation here
        setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
        setSelectionMode(false);
        setSelectedIds(new Set());
        setConfirmVisible(false);
    };

    const handleDownloadStub = () => {
        Alert.alert("Receipt Generated", "The receipt has been saved to your device.");
    };

    return (
        <SafeScreen style={styles.container}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.headerText, { color: theme.textPrimary }]}>Transaction History</Text>
            </View>

            {!selectionMode ? (
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
                        setSelectedIds(new Set());
                    }}
                    onSelectAll={() => setSelectedIds(new Set(filteredTransactions.map(t => t.id)))}
                    onDelete={() => setConfirmVisible(true)}
                />
            )}

            <FlatList
                data={filteredTransactions}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TransactionCard
                        transaction={item}
                        isSelected={selectedIds.has(item.id)}
                        selectionMode={selectionMode}
                        onSelect={() => toggleSelection(item.id)}
                        onPress={() => handlePress(item)}
                    />
                )}
                ListEmptyComponent={
                    <EmptyList
                        icon="receipt"
                        message="No purchases found"
                        submessage="Try changing the date filter or start shopping!"
                    />
                }
            />

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
                onConfirm={handleDelete}
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
    }
});
