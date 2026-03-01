import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
// Alert is used for user feedback — Toast will be added in Phase 20
import { CartItem, CartItemData, CartSummary, CartWarningBanner } from '../../components/cart-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyList } from '../../components/ui/empty-list';
import { LoadingModal } from '../../components/ui/loading-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { supabase } from '../../supabase/supabaseClient';
import { lightPalette } from '../../utils/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItemRaw {
    id: number;
    uid: string;
    quantity: number;
    product_id: number;
    variant_id: number;
    product_variants: {
        uid: string;
        name: string;
        price: number;
        stock: number;
        image_url: string | null;
        sale_price: number | null;
        sale_start_date: string | null;
        sale_end_date: string | null;
    };
    products: {
        uid: string;
        name: string;
        thumbnail_url: string;
        deleted_at: string | null;
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

const mapToCartItemData = (raw: CartItemRaw): CartItemData => ({
    uid: raw.uid,
    productUid: raw.products.uid,
    productName: raw.products.name,
    variantName: raw.product_variants.name,
    price: getEffectivePrice(raw.product_variants),
    thumbnailUrl: raw.products.thumbnail_url,
    quantity: raw.quantity,
    stock: raw.product_variants.stock,
    isAvailable: raw.products.deleted_at === null && raw.product_variants.stock > 0,
    // Price change: if current effective price differs from simple price
    hasPriceChanged: false,
});

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Cart page — shows current cart items with swipe-to-delete, quantity controls,
 * checkboxes for batch selection/delete, total calculation, and checkout CTA.
 * Validates stock/availability on load and warns for issues.
 */
export default function CartScreen(): React.JSX.Element {
    const [cartItems, setCartItems] = useState<CartItemData[]>([]);
    const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [updatingUids, setUpdatingUids] = useState<Set<string>>(new Set());
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

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

    // ─── Fetch user ──────────────────────────────────────────────────────────

    useEffect(() => {
        const getUser = async (): Promise<void> => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                const { data } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth_id', session.user.id)
                    .single();
                if (data) setCurrentUserId(data.id);
            }
        };
        void getUser();
    }, []);

    // ─── Fetch cart ──────────────────────────────────────────────────────────

    const fetchCart = useCallback(async (userId: number): Promise<void> => {
        try {
            const { data } = await supabase
                .from('cart_items')
                .select('*, product_variants(*), products!inner(uid, name, thumbnail_url, deleted_at)')
                .eq('user_id', userId);

            const mapped = (data as unknown as CartItemRaw[] | null ?? []).map(mapToCartItemData);
            setCartItems(mapped);
            // Auto-select all available items
            setSelectedUids(new Set(mapped.filter((i) => i.isAvailable).map((i) => i.uid)));
        } catch {
            Alert.alert('Error', 'Failed to load cart. Please try again.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (currentUserId !== null) {
            setIsLoading(true);
            void fetchCart(currentUserId);
        }
    }, [currentUserId, fetchCart]);

    const handleRefresh = useCallback((): void => {
        if (currentUserId === null) return;
        setIsRefreshing(true);
        void fetchCart(currentUserId);
    }, [currentUserId, fetchCart]);

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

    const handleQuantityChange = useCallback(async (uid: string, newQty: number): Promise<void> => {
        const item = cartItems.find((i) => i.uid === uid);
        if (!item) return;

        const clampedQty = Math.max(1, Math.min(newQty, Math.min(99, item.stock)));

        setUpdatingUids((prev) => new Set(prev).add(uid));
        setCartItems((prev) => prev.map((i) => i.uid === uid ? { ...i, quantity: clampedQty } : i));

        try {
            await supabase.from('cart_items').update({ quantity: clampedQty }).eq('uid', uid);
        } catch {
            // Revert on error
            setCartItems((prev) => prev.map((i) => i.uid === uid ? { ...i, quantity: item.quantity } : i));
            Alert.alert('Error', 'Failed to update quantity.');
        } finally {
            setUpdatingUids((prev) => { const s = new Set(prev); s.delete(uid); return s; });
        }
    }, [cartItems]);

    // ─── Delete single item ──────────────────────────────────────────────────

    const confirmDeleteItem = useCallback((uid: string): void => {
        const item = cartItems.find((i) => i.uid === uid);
        setConfirmDialog({
            visible: true,
            title: 'Remove Item',
            message: `Remove "${item?.productName}" from your cart?`,
            onConfirm: () => {
                setConfirmDialog((d) => ({ ...d, visible: false }));
                void deleteItems([uid]);
            },
        });
    }, [cartItems]);

    const deleteItems = useCallback(async (uids: string[]): Promise<void> => {
        try {
            await supabase.from('cart_items').delete().in('uid', uids);
            setCartItems((prev) => prev.filter((i) => !uids.includes(i.uid)));
            setSelectedUids((prev) => {
                const next = new Set(prev);
                uids.forEach((u) => next.delete(u));
                return next;
            });
            // No-op success feedback for delete (item disappears from list)
        } catch {
            Alert.alert('Error', 'Failed to remove item.');
        }
    }, []);

    // ─── Batch delete ────────────────────────────────────────────────────────

    const handleBatchDelete = useCallback((): void => {
        const count = selectedUids.size;
        if (count === 0) return;

        setConfirmDialog({
            visible: true,
            title: 'Remove Selected Items',
            message: `Remove ${count} selected item${count !== 1 ? 's' : ''} from your cart?`,
            onConfirm: () => {
                setConfirmDialog((d) => ({ ...d, visible: false }));
                void deleteItems(Array.from(selectedUids));
            },
        });
    }, [selectedUids, deleteItems]);

    // ─── Checkout ────────────────────────────────────────────────────────────

    const handleCheckout = useCallback((): void => {
        const selectedItems = cartItems.filter((i) => selectedUids.has(i.uid) && i.isAvailable);
        if (selectedItems.length === 0) return;

        // Pass UIDs to checkout screen
        router.push({
            pathname: '/home/checkout' as string,
            params: { cartUids: Array.from(selectedUids).join(',') },
        } as Parameters<typeof router.push>[0]);
    }, [cartItems, selectedUids]);

    // ─── Totals ──────────────────────────────────────────────────────────────

    const selectedItems = cartItems.filter((i) => selectedUids.has(i.uid) && i.isAvailable);
    const totalAmount = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const availableUids = cartItems.filter((i) => i.isAvailable).map((i) => i.uid);
    const allSelected = availableUids.length > 0 && availableUids.every((uid) => selectedUids.has(uid));

    // ─── Render ──────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SafeScreen>
                <LoadingModal isVisible message="Loading cart…" />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={styles.root}>
            {/* Batch toolbar */}
            <View style={styles.toolbar}>
                <TouchableOpacity style={styles.selectAllBtn} onPress={handleSelectAll}>
                    <View style={[styles.selectAllCheck, allSelected && styles.selectAllCheckActive]}>
                        {allSelected && <Text style={styles.selectAllCheckmark}>✓</Text>}
                    </View>
                    <Text style={styles.selectAllText}>
                        {allSelected ? 'Deselect All' : 'Select All'}
                    </Text>
                </TouchableOpacity>

                {selectedUids.size > 0 && (
                    <TouchableOpacity style={styles.batchDeleteBtn} onPress={handleBatchDelete}>
                        <Text style={styles.batchDeleteText}>🗑️ Delete ({selectedUids.size})</Text>
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
                ItemSeparatorComponent={() => <View style={styles.separator} />}
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
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        colors={[lightPalette.primary]}
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
        backgroundColor: lightPalette.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: lightPalette.border,
    },
    selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    selectAllCheck: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: lightPalette.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectAllCheckActive: {
        backgroundColor: lightPalette.primary,
        borderColor: lightPalette.primary,
    },
    selectAllCheckmark: { color: lightPalette.white, fontSize: 13, fontWeight: '700' },
    selectAllText: { fontSize: 14, fontWeight: '600', color: lightPalette.textPrimary },
    batchDeleteBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(245,54,92,0.1)',
    },
    batchDeleteText: { color: lightPalette.error, fontSize: 13, fontWeight: '700' },
    list: { flex: 1 },
    separator: {
        height: 1,
        backgroundColor: lightPalette.border,
        marginHorizontal: 16,
    },
    emptyIcon: { fontSize: 40 },
});
