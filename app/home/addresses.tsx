import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AddressCard, AddressData, AddressForm, ShopAddressData } from '../../components/address-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyList } from '../../components/ui/empty-list';
import { LoadingModal } from '../../components/ui/loading-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { supabase } from '../../supabase/supabaseClient';
import { lightPalette } from '../../utils/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ADDRESSES = 10;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AddressesScreen — manages all saved delivery addresses for the logged-in user.
 * Features: FlatList with AddressCard, add/edit/delete, set-as-default,
 * max 10 limit enforcement, copy-from-shop for sellers, and ConfirmDialog on mutations.
 */
export default function AddressesScreen(): React.JSX.Element {
    const [addresses, setAddresses] = useState<AddressData[]>([]);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [shopAddress, setShopAddress] = useState<ShopAddressData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Form modal state
    const [formVisible, setFormVisible] = useState<boolean>(false);
    const [editingAddress, setEditingAddress] = useState<AddressData | null>(null);

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ visible: false, title: '', message: '', onConfirm: () => undefined });

    // ─── Bootstrap: load user + addresses ────────────────────────────────

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

            // Get user record
            const { data: user } = await supabase
                .from('users')
                .select('id, role')
                .eq('auth_id', session.user.id)
                .single();

            if (user === null) return;
            setCurrentUserId(user.id);

            // Load addresses
            await loadAddresses(user.id);

            // Load shop address for sellers (for the "copy" shortcut)
            if (user.role === 'seller') {
                const { data: shop } = await supabase
                    .from('shops')
                    .select('country, province, city')
                    .eq('user_id', user.id)
                    .is('deleted_at', null)
                    .single();

                if (shop !== null) {
                    setShopAddress({
                        country: shop.country,
                        province: shop.province,
                        city: shop.city,
                    });
                }
            }
        } catch {
            Alert.alert('Error', 'Failed to load your addresses.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadAddresses = useCallback(async (userId: number): Promise<void> => {
        const { data } = await supabase
            .from('addresses')
            .select('uid, country, province, city, barangay, address_detail, landmark, phone_number, is_default')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true });

        const mapped: AddressData[] = (data ?? []).map((d) => ({
            uid: d.uid,
            country: d.country,
            province: d.province,
            city: d.city,
            barangay: d.barangay,
            address_detail: d.address_detail,
            landmark: d.landmark,
            phone_number: d.phone_number,
            is_default: d.is_default,
        }));
        setAddresses(mapped);
    }, []);

    // ─── Add new address ─────────────────────────────────────────────────

    const handleAddPress = useCallback((): void => {
        if (addresses.length >= MAX_ADDRESSES) {
            Alert.alert(
                'Limit Reached',
                `You can only save up to ${MAX_ADDRESSES} addresses. Please delete one to add a new address.`,
            );
            return;
        }
        setEditingAddress(null);
        setFormVisible(true);
    }, [addresses.length]);

    // ─── Edit address ────────────────────────────────────────────────────

    const handleEdit = useCallback((address: AddressData): void => {
        setConfirmDialog({
            visible: true,
            title: 'Edit Address',
            message: 'Do you want to edit this address?',
            onConfirm: () => {
                setConfirmDialog((d) => ({ ...d, visible: false }));
                setEditingAddress(address);
                setFormVisible(true);
            },
        });
    }, []);

    // ─── Delete address ──────────────────────────────────────────────────

    const handleDelete = useCallback((uid: string): void => {
        setConfirmDialog({
            visible: true,
            title: 'Delete Address',
            message: 'Are you sure you want to delete this address? This cannot be undone.',
            onConfirm: () => {
                setConfirmDialog((d) => ({ ...d, visible: false }));
                void performDelete(uid);
            },
        });
    }, []);

    const performDelete = useCallback(async (uid: string): Promise<void> => {
        const { error } = await supabase
            .from('addresses')
            .delete()
            .eq('uid', uid);

        if (error !== null) {
            Alert.alert('Error', 'Failed to delete address. Please try again.');
            return;
        }
        setAddresses((prev) => {
            const remaining = prev.filter((a) => a.uid !== uid);
            // If deleted was default, auto-promote first remaining
            const deletedWasDefault = prev.find((a) => a.uid === uid)?.is_default ?? false;
            if (deletedWasDefault && remaining.length > 0) {
                void setDefaultInDB(remaining[0].uid);
                return remaining.map((a, idx) => ({ ...a, is_default: idx === 0 }));
            }
            return remaining;
        });
    }, []);

    // ─── Set default ─────────────────────────────────────────────────────

    const handleSetDefault = useCallback((uid: string): void => {
        void setDefaultInDB(uid);
        setAddresses((prev) =>
            prev.map((a) => ({ ...a, is_default: a.uid === uid })),
        );
    }, []);

    const setDefaultInDB = useCallback(async (uid: string): Promise<void> => {
        if (currentUserId === null) return;
        // Clear all defaults then set new one
        await supabase
            .from('addresses')
            .update({ is_default: false })
            .eq('user_id', currentUserId);
        await supabase
            .from('addresses')
            .update({ is_default: true })
            .eq('uid', uid);
    }, [currentUserId]);

    // ─── Form save callback ───────────────────────────────────────────────

    const handleFormSave = useCallback(
        (saved: AddressData): void => {
            setAddresses((prev) => {
                const exists = prev.findIndex((a) => a.uid === saved.uid);
                if (exists >= 0) {
                    // Update in-place
                    return prev.map((a) => (a.uid === saved.uid ? saved : a));
                }
                // New address — if it's the first, it becomes default
                const updated = [...prev, saved];
                return updated.sort((a, _b) => (a.is_default ? -1 : 1));
            });
            setFormVisible(false);
            setEditingAddress(null);
        },
        [],
    );

    // ─── Render ───────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SafeScreen>
                <LoadingModal isVisible message="Loading addresses…" />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.back()}
                    id="back-button"
                >
                    <Text style={styles.backText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Addresses</Text>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={handleAddPress}
                    id="add-address-button"
                >
                    <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {/* Count pill */}
            <View style={styles.countRow}>
                <Text style={styles.countText}>
                    {addresses.length} / {MAX_ADDRESSES} addresses
                </Text>
            </View>

            <FlatList
                data={addresses}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => (
                    <AddressCard
                        address={item}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onSetDefault={handleSetDefault}
                    />
                )}
                ListEmptyComponent={
                    <EmptyList
                        icon={<Text style={styles.emptyIcon}>📍</Text>}
                        message="No delivery address yet!"
                        submessage="Add your first address to enable checkout."
                        actionButton={{ label: 'Add Address', onPress: handleAddPress }}
                    />
                }
                contentContainerStyle={addresses.length === 0 ? { flex: 1 } : { paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            />

            {/* Add/Edit form modal */}
            <Modal
                visible={formVisible}
                animationType="slide"
                onRequestClose={() => {
                    setFormVisible(false);
                    setEditingAddress(null);
                }}
            >
                {currentUserId !== null && (
                    <AddressForm
                        userId={currentUserId}
                        shopAddress={shopAddress}
                        initialData={editingAddress}
                        onSave={handleFormSave}
                        onCancel={() => {
                            setFormVisible(false);
                            setEditingAddress(null);
                        }}
                        currentCount={addresses.length}
                    />
                )}
            </Modal>

            {/* Confirm dialog */}
            <ConfirmDialog
                visible={confirmDialog.visible}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog((d) => ({ ...d, visible: false }))}
                confirmLabel="Confirm"
                cancelLabel="Cancel"
                variant="danger"
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
    backBtn: {
        padding: 4,
    },
    backText: {
        fontSize: 17,
        color: lightPalette.primary,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: lightPalette.textPrimary,
    },
    addBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: lightPalette.primary,
        borderRadius: 20,
    },
    addBtnText: {
        color: lightPalette.white,
        fontWeight: '800',
        fontSize: 14,
    },
    countRow: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    countText: {
        fontSize: 13,
        color: lightPalette.textSecondary,
        fontWeight: '500',
    },
    emptyIcon: { fontSize: 40 },
});
