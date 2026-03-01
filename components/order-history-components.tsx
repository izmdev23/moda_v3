import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AccessibleTouchable } from './ui/accessible-touchable';
import { useTheme } from './ui/theme-provider';

export interface TransactionData {
    id: string;
    createDate: Date;
    itemCount: number;
    total: number;
    paymentMethod: string;
    status: 'completed' | 'cancelled';
    items: { id: string; name: string; thumbnail: string; price: number; quantity: number }[];
}

interface TransactionCardProps {
    transaction: TransactionData;
    isSelected?: boolean;
    onSelect?: () => void;
    onPress: () => void;
    selectionMode?: boolean;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
    transaction, isSelected, onSelect, onPress, selectionMode
}) => {
    const { theme } = useTheme();

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <TouchableOpacity
            style={[
                styles.card,
                {
                    backgroundColor: isSelected ? theme.primary + '10' : theme.cardBackground,
                    borderColor: isSelected ? theme.primary : theme.border
                }
            ]}
            onPress={selectionMode && onSelect ? onSelect : onPress}
            onLongPress={onSelect}
            activeOpacity={0.8}
        >
            <View style={styles.cardHeader}>
                <Text style={[styles.date, { color: theme.textSecondary }]}>{formatDate(transaction.createDate)}</Text>
                <Text style={[styles.status, { color: transaction.status === 'completed' ? theme.success : theme.error }]}>
                    {transaction.status.toUpperCase()}
                </Text>
            </View>
            <View style={styles.cardBody}>
                <View style={styles.iconContainer}>
                    <MaterialIcons name="receipt" size={32} color={theme.textSecondary} />
                </View>
                <View style={styles.details}>
                    <Text style={[styles.items, { color: theme.textPrimary }]}>{transaction.itemCount} items</Text>
                    <Text style={[styles.payment, { color: theme.textSecondary }]}>{transaction.paymentMethod}</Text>
                </View>
                <Text style={[styles.total, { color: theme.primary }]}>₱{transaction.total.toFixed(2)}</Text>
            </View>

            {selectionMode && (
                <View style={styles.checkboxContainer}>
                    <MaterialIcons
                        name={isSelected ? "check-circle" : "radio-button-unchecked"}
                        size={24}
                        color={isSelected ? theme.primary : theme.textSecondary}
                    />
                </View>
            )}
        </TouchableOpacity>
    );
};

interface TransactionDetailModalProps {
    visible: boolean;
    transaction: TransactionData | null;
    onClose: () => void;
    onDownloadReceipt: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
    visible, transaction, onClose, onDownloadReceipt
}) => {
    const { theme } = useTheme();

    if (!transaction) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Transaction Details</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={[styles.summaryBox, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <Text style={[styles.summaryRef, { color: theme.textSecondary }]}>Ref: {transaction.id}</Text>
                            <Text style={[styles.summaryTotal, { color: theme.primary }]}>₱{transaction.total.toFixed(2)}</Text>
                            <Text style={[styles.summaryDate, { color: theme.textSecondary }]}>
                                {transaction.createDate.toLocaleString()}
                            </Text>
                            <Text style={[styles.summaryPay, { color: theme.textSecondary }]}>
                                Paid via {transaction.paymentMethod}
                            </Text>
                        </View>

                        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Items Purchased</Text>
                        {transaction.items.map(item => (
                            <View key={item.id} style={[styles.itemRow, { borderBottomColor: theme.border }]}>
                                <Image source={{ uri: item.thumbnail }} style={styles.itemImage} />
                                <View style={styles.itemInfo}>
                                    <Text style={[styles.itemName, { color: theme.textPrimary }]}>{item.name}</Text>
                                    <Text style={[styles.itemQty, { color: theme.textSecondary }]}>Qty: {item.quantity}</Text>
                                </View>
                                <Text style={[styles.itemPrice, { color: theme.textPrimary }]}>₱{item.price.toFixed(2)}</Text>
                            </View>
                        ))}
                    </ScrollView>

                    <View style={[styles.modalFooter, { borderTopColor: theme.border, backgroundColor: theme.cardBackground }]}>
                        <AccessibleTouchable
                            style={[styles.downloadBtn, { backgroundColor: theme.primary }]}
                            onPress={onDownloadReceipt}
                            accessibilityLabel="Download Receipt"
                        >
                            <MaterialIcons name="file-download" size={20} color={theme.white} style={{ marginRight: 8 }} />
                            <Text style={[styles.downloadText, { color: theme.white }]}>Download Receipt</Text>
                        </AccessibleTouchable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export type DateRange = '7d' | '30d' | '3mo' | 'all';

interface DateRangeFilterProps {
    activeRange: DateRange;
    onChange: (range: DateRange) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ activeRange, onChange }) => {
    const { theme } = useTheme();
    const ranges: { val: DateRange, label: string }[] = [
        { val: '7d', label: 'Last 7 Days' },
        { val: '30d', label: 'Last 30 Days' },
        { val: '3mo', label: 'Last 3 Months' },
        { val: 'all', label: 'All Time' }
    ];

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {ranges.map(r => {
                const isActive = activeRange === r.val;
                return (
                    <TouchableOpacity
                        key={r.val}
                        style={[
                            styles.filterChip,
                            {
                                backgroundColor: isActive ? theme.primary : theme.cardBackground,
                                borderColor: isActive ? theme.primary : theme.border
                            }
                        ]}
                        onPress={() => onChange(r.val)}
                    >
                        <Text style={{ color: isActive ? theme.white : theme.textSecondary, fontSize: 13 }}>
                            {r.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

interface MultiSelectToolbarProps {
    selectedCount: number;
    onClear: () => void;
    onSelectAll: () => void;
    onDelete: () => void;
}

export const MultiSelectToolbar: React.FC<MultiSelectToolbarProps> = ({ selectedCount, onClear, onSelectAll, onDelete }) => {
    const { theme } = useTheme();

    if (selectedCount === 0) return null;

    return (
        <View style={[styles.toolbar, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={onClear}>
                <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.toolbarCount, { color: theme.textPrimary }]}>{selectedCount} Selected</Text>
            <View style={styles.toolbarActions}>
                <TouchableOpacity onPress={onSelectAll} style={{ marginRight: 16 }}>
                    <MaterialIcons name="select-all" size={24} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete}>
                    <MaterialIcons name="delete-outline" size={24} color={theme.error} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// Receipt Generator Stub
export const ReceiptGenerator = {
    generateAndShare: async (transaction: TransactionData) => {
        // Stub implementation
        console.log("Generating receipt for", transaction.id);
        return true;
    }
};

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    date: {
        fontSize: 13,
    },
    status: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    cardBody: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: 16,
    },
    details: {
        flex: 1,
    },
    items: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    payment: {
        fontSize: 13,
    },
    total: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    checkboxContainer: {
        position: 'absolute',
        top: 16,
        right: 16,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '80%',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 16,
    },
    summaryBox: {
        padding: 16,
        borderWidth: 1,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 24,
    },
    summaryRef: {
        fontSize: 12,
        marginBottom: 8,
    },
    summaryTotal: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    summaryDate: {
        fontSize: 14,
        marginBottom: 4,
    },
    summaryPay: {
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    itemImage: {
        width: 48,
        height: 48,
        borderRadius: 4,
        marginRight: 12,
        backgroundColor: '#E0E0E0',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 4,
    },
    itemQty: {
        fontSize: 13,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '600',
    },
    modalFooter: {
        padding: 16,
        borderTopWidth: 1,
    },
    downloadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 8,
    },
    downloadText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    filterScroll: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    toolbarCount: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 16,
        flex: 1,
    },
    toolbarActions: {
        flexDirection: 'row',
        alignItems: 'center',
    }
});
