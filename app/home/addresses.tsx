import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { AddressCard, AddressData, AddressForm, ShopAddressData } from '../../components/address-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { supabase } from '../../supabase/supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ADDRESSES = 10;

const ADDRESS_SKELETON_ROW_COUNT = 4;

function AddressesListSkeleton(): React.JSX.Element {
    return (
        <View style={styles.skeletonWrap}>
            {Array.from({ length: ADDRESS_SKELETON_ROW_COUNT }).map((_, index) => (
                <View key={`address-skeleton-${index}`} style={styles.skeletonCard}>
                    <SkeletonLoader width="38%" height={14} style={styles.skeletonGap} />
                    <SkeletonLoader width="80%" height={12} style={styles.skeletonGap} />
                    <SkeletonLoader width="64%" height={12} />
                    <View style={styles.skeletonActions}>
                        <SkeletonLoader width={84} height={30} borderRadius={8} />
                        <SkeletonLoader width={66} height={30} borderRadius={8} />
                    </View>
                </View>
            ))}
        </View>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AddressesScreen — manages all saved delivery addresses for the logged-in user.
 * Features: FlatList with AddressCard, add/edit/delete, set-as-default,
 * max 10 limit enforcement, copy-from-shop for sellers, and ConfirmDialog on mutations.
 */
export default function AddressesScreen(): React.JSX.Element {
    const { theme } = useTheme();
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
            AppAlert.alert('Error', 'Failed to load your addresses.');
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
            AppAlert.alert(
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
            AppAlert.alert('Error', 'Failed to delete address. Please try again.');
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

    return (
        <SafeScreen style={styles.root}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <RipplePressable
                    style={styles.backBtn}
                    onPress={() => router.back()}
                    id="back-button"
                >
                    <Text style={[styles.backText, { color: theme.primary }]}>‹ Back</Text>
                </RipplePressable>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>My Addresses</Text>
                <RipplePressable
                    style={[styles.addBtn, { backgroundColor: theme.primary }]}
                    onPress={handleAddPress}
                    id="add-address-button"
                >
                    <Text style={[styles.addBtnText, { color: theme.white }]}>+ Add</Text>
                </RipplePressable>
            </View>

            {/* Count pill */}
            <View style={styles.countRow}>
                <Text style={[styles.countText, { color: theme.textSecondary }]}>
                    {addresses.length} / {MAX_ADDRESSES} addresses
                </Text>
            </View>

            {isLoading ? (
                <AddressesListSkeleton />
            ) : (
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
            )}

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
    },
    backBtn: {
        padding: 4,
    },
    backText: {
        fontSize: 17,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    addBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
    },
    addBtnText: {
        fontWeight: '800',
        fontSize: 14,
    },
    countRow: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    countText: {
        fontSize: 13,
        fontWeight: '500',
    },
    skeletonWrap: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 16,
    },
    skeletonCard: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    skeletonGap: {
        marginBottom: 8,
    },
    skeletonActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    emptyIcon: { fontSize: 40 },
});
