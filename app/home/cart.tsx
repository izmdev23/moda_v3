import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
// Alert is used for user feedback — Toast will be added in Phase 20
import { CartItem, CartSummary, CartWarningBanner } from '../../components/cart-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import type { CartItemData } from '../../hooks/use-cart';
import { useCartItems, useDeleteCartItems, useUpdateCartQuantity } from '../../hooks/use-cart';
import { useCurrentUser } from '../../hooks/use-current-user';

// ─── Cart Skeleton ────────────────────────────────────────────────────────────

const CartItemSkeleton: React.FC = () => (
    <View style={cartSkeletonStyles.item}>
        <SkeletonLoader width={72} height={72} borderRadius={8} />
        <View style={cartSkeletonStyles.itemBody}>
            <SkeletonLoader height={14} width="75%" style={{ marginBottom: 7 }} />
            <SkeletonLoader height={12} width="50%" style={{ marginBottom: 7 }} />
            <SkeletonLoader height={16} width="35%" />
        </View>
    </View>
);

const CartSkeleton: React.FC = () => (
    <View style={cartSkeletonStyles.container}>
        {Array.from({ length: 4 }).map((_, i) => <CartItemSkeleton key={i} />)}
    </View>
);

const cartSkeletonStyles = StyleSheet.create({
    container: { paddingTop: 8 },
    item: { flexDirection: 'row', padding: 16, gap: 12 },
    itemBody: { flex: 1, justifyContent: 'center' },
});

const CART_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Cart page — shows current cart items with swipe-to-delete, quantity controls,
 * checkboxes for batch selection/delete, total calculation, and checkout CTA.
 * Validates stock/availability on load and warns for issues.
 */
export default function CartScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { data: currentUser } = useCurrentUser();
    const userId = currentUser?.id ?? null;

    const { data: cartItems = [], isLoading, isRefetching, refetch } = useCartItems(userId);
    const updateQtyMutation = useUpdateCartQuantity(userId);
    const deleteItemsMutation = useDeleteCartItems(userId);

    const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
    const [updatingUids, setUpdatingUids] = useState<Set<string>>(new Set());

    // Auto-select all available items when cart loads (first load only)
    const [autoSelected, setAutoSelected] = useState<boolean>(false);
    React.useEffect(() => {
        if (cartItems.length > 0 && !autoSelected) {
            setSelectedUids(new Set(cartItems.filter((i) => i.isAvailable).map((i) => i.uid)));
            setAutoSelected(true);
        }
        // Reset auto-select when user logs out / cart is cleared
        if (cartItems.length === 0) setAutoSelected(false);
    }, [cartItems, autoSelected]);

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ visible: false, title: '', message: '', onConfirm: () => undefined });

    const warnings: string[] = cartItems
        .filter((i) => !i.isAvailable)
        .map((i) => `"${i.productName}" is no longer available.`);

    // ─── Selection ───────────────────────────────────────────────────────────

    const handleSelect = useCallback((uid: string): void => {
        setSelectedUids((prev) => {
            const next = new Set(prev);
            if (next.has(uid)) next.delete(uid);
            else next.add(uid);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback((): void => {
        const availableUids = cartItems.filter((i) => i.isAvailable).map((i) => i.uid);
        const allSelected = availableUids.every((uid) => selectedUids.has(uid));
        if (allSelected) {
            setSelectedUids(new Set());
        } else {
            setSelectedUids(new Set(availableUids));
        }
    }, [cartItems, selectedUids]);

    // ─── Quantity change ─────────────────────────────────────────────────────

    const handleQuantityChange = useCallback((uid: string, newQty: number): void => {
        const item = cartItems.find((i) => i.uid === uid);
        if (!item) return;

        const clampedQty = Math.max(1, Math.min(newQty, Math.min(99, item.stock)));
        setUpdatingUids((prev) => new Set(prev).add(uid));

        updateQtyMutation.mutate({ uid, quantity: clampedQty }, {
            onSettled: () => {
                setUpdatingUids((prev) => { const s = new Set(prev); s.delete(uid); return s; });
            },
            onError: () => {
                Alert.alert('Error', 'Failed to update quantity.');
            },
        });
    }, [cartItems, updateQtyMutation]);

    // ─── Delete items ────────────────────────────────────────────────────────

    const deleteItems = useCallback((uids: string[]): void => {
        deleteItemsMutation.mutate(uids, {
            onSuccess: () => {
                setSelectedUids((prev) => {
                    const next = new Set(prev);
                    uids.forEach((u) => next.delete(u));
                    return next;
                });
            },
            onError: () => {
                Alert.alert('Error', 'Failed to remove item.');
            },
        });
    }, [deleteItemsMutation]);

    const confirmDeleteItem = useCallback((uid: string): void => {
        const item = cartItems.find((i) => i.uid === uid);
        setConfirmDialog({
            visible: true,
            title: 'Remove Item',
            message: `Remove "${item?.productName}" from your cart?`,
            onConfirm: () => {
                setConfirmDialog((d) => ({ ...d, visible: false }));
                deleteItems([uid]);
            },
        });
    }, [cartItems, deleteItems]);

    const handleBatchDelete = useCallback((): void => {
        const count = selectedUids.size;
        if (count === 0) return;

        setConfirmDialog({
            visible: true,
            title: 'Remove Selected Items',
            message: `Remove ${count} selected item${count !== 1 ? 's' : ''} from your cart?`,
            onConfirm: () => {
                setConfirmDialog((d) => ({ ...d, visible: false }));
                deleteItems(Array.from(selectedUids));
            },
        });
    }, [selectedUids, deleteItems]);

    // ─── Checkout ────────────────────────────────────────────────────────────

    const handleCheckout = useCallback((): void => {
        const selectedItems = cartItems.filter((i) => selectedUids.has(i.uid) && i.isAvailable);
        if (selectedItems.length === 0) return;

        router.push({
            pathname: '/home/checkout' as string,
            params: { cartUids: Array.from(selectedUids).join(',') },
        } as Parameters<typeof router.push>[0]);
    }, [cartItems, selectedUids]);

    // ─── Totals ──────────────────────────────────────────────────────────────

    const selectedItems = cartItems.filter((i: CartItemData) => selectedUids.has(i.uid) && i.isAvailable);
    const totalAmount = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const availableUids = cartItems.filter((i: CartItemData) => i.isAvailable).map((i) => i.uid);
    const allSelected = availableUids.length > 0 && availableUids.every((uid) => selectedUids.has(uid));

    // ─── Render ──────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SafeScreen edges={CART_SAFE_AREA_EDGES}>
                <CartSkeleton />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={styles.root} edges={CART_SAFE_AREA_EDGES}>
            {/* Batch toolbar */}
            <View style={[styles.toolbar, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <TouchableOpacity style={styles.selectAllBtn} onPress={handleSelectAll}>
                    <View style={[
                        styles.selectAllCheck,
                        { borderColor: theme.border },
                        allSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}>
                        {allSelected && <Text style={[styles.selectAllCheckmark, { color: theme.white }]}>✓</Text>}
                    </View>
                    <Text style={[styles.selectAllText, { color: theme.textPrimary }]}>
                        {allSelected ? 'Deselect All' : 'Select All'}
                    </Text>
                </TouchableOpacity>

                {selectedUids.size > 0 && (
                    <TouchableOpacity style={[styles.batchDeleteBtn, { backgroundColor: `${theme.error}18` }]} onPress={handleBatchDelete}>
                        <Text style={[styles.batchDeleteText, { color: theme.error }]}>🗑️ Delete ({selectedUids.size})</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Warnings */}
            {warnings.map((w, idx) => (
                <CartWarningBanner key={idx} message={w} />
            ))}

            <FlatList
                data={cartItems}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => (
                    <CartItem
                        item={item}
                        isSelected={selectedUids.has(item.uid)}
                        onSelect={handleSelect}
                        onDelete={confirmDeleteItem}
                        onQuantityChange={handleQuantityChange}
                        onProductPress={(productUid) =>
                            router.push({ pathname: '/home/product-details' as string, params: { uid: productUid } } as Parameters<typeof router.push>[0])
                        }
                        isUpdating={updatingUids.has(item.uid)}
                    />
                )}
                ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
                ListEmptyComponent={
                    <EmptyList
                        icon={<Text style={styles.emptyIcon}>🛍️</Text>}
                        message="Your wardrobe awaits!"
                        submessage="Add items from the catalog to start shopping."
                        actionButton={{
                            label: 'Browse Products',
                            onPress: () => router.push('/home/catalog' as Parameters<typeof router.push>[0]),
                        }}
                    />
                }
                contentContainerStyle={cartItems.length === 0 ? { flex: 1 } : {}}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={() => void refetch()}
                        colors={[theme.primary]}
                    />
                }
                showsVerticalScrollIndicator={false}
                style={styles.list}
            />

            {/* Summary bar */}
            {cartItems.length > 0 && (
                <CartSummary
                    selectedCount={selectedItems.length}
                    totalAmount={totalAmount}
                    onCheckout={handleCheckout}
                    isCheckoutDisabled={selectedItems.length === 0}
                />
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                visible={confirmDialog.visible}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog((d) => ({ ...d, visible: false }))}
                confirmLabel="Remove"
                cancelLabel="Keep"
                variant="danger"
            />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    selectAllCheck: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectAllCheckmark: { fontSize: 13, fontWeight: '700' },
    selectAllText: { fontSize: 14, fontWeight: '600' },
    batchDeleteBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    batchDeleteText: { fontSize: 13, fontWeight: '700' },
    list: { flex: 1 },
    separator: {
        height: 1,
        marginHorizontal: 16,
    },
    emptyIcon: { fontSize: 40 },
});
