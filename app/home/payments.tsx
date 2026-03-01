import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    AddPaymentForm,
    PaymentMethodCard,
    StoredPaymentMethod,
    StoredPaymentType,
} from '../../components/payments-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyList } from '../../components/ui/empty-list';
import { LoadingModal } from '../../components/ui/loading-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { supabase } from '../../supabase/supabaseClient';
import { lightPalette } from '../../utils/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_NUMBER_REGEX = /^[0-9+\-\s]{7,20}$/;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PaymentsScreen — lists all saved GCash/Maya accounts with add/remove/set-default controls.
 * Uses AddPaymentForm inline and ConfirmDialog on destructive actions.
 */
export default function PaymentsScreen(): React.JSX.Element {
    const [methods, setMethods] = useState<StoredPaymentMethod[]>([]);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [showAddForm, setShowAddForm] = useState<boolean>(false);

    // Add form local state
    const [newType, setNewType] = useState<StoredPaymentType | null>(null);
    const [newAccountNumber, setNewAccountNumber] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ visible: false, title: '', message: '', onConfirm: () => undefined });

    // ─── Bootstrap ────────────────────────────────────────────────────────

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

            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', session.user.id)
                .single();

            if (user === null) return;
            setCurrentUserId(user.id);
            await loadMethods(user.id);
        } catch {
            Alert.alert('Error', 'Failed to load payment methods.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadMethods = useCallback(async (userId: number): Promise<void> => {
        const { data } = await supabase
            .from('payment_methods')
            .select('uid, type, account_number, is_default')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true });

        const mapped: StoredPaymentMethod[] = (data ?? []).map((d) => ({
            uid: d.uid,
            type: d.type as StoredPaymentType,
            account_number: d.account_number,
            is_default: d.is_default,
        }));
        setMethods(mapped);
    }, []);

    // ─── Add payment method ───────────────────────────────────────────────

    const handleSubmitAdd = useCallback(async (): Promise<void> => {
        if (newType === null) {
            Alert.alert('Select Type', 'Please choose GCash or Maya.');
            return;
        }
        if (!ACCOUNT_NUMBER_REGEX.test(newAccountNumber.trim())) {
            Alert.alert('Invalid Number', 'Please enter a valid mobile/account number (7–20 digits).');
            return;
        }
        if (currentUserId === null) return;

        setIsSubmitting(true);
        try {
            const isFirst = methods.length === 0;
            const { data, error } = await supabase
                .from('payment_methods')
                .insert({
                    user_id: currentUserId,
                    type: newType,
                    account_number: newAccountNumber.trim(),
                    is_default: isFirst,
                })
                .select('uid, type, account_number, is_default')
                .single();

            if (error !== null) throw error;
            if (data !== null) {
                const newMethod: StoredPaymentMethod = {
                    uid: data.uid,
                    type: data.type as StoredPaymentType,
                    account_number: data.account_number,
                    is_default: data.is_default,
                };
                setMethods((prev) => [...prev, newMethod]);
            }
            setShowAddForm(false);
            setNewType(null);
            setNewAccountNumber('');
        } catch {
            Alert.alert('Error', 'Failed to save payment method. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [newType, newAccountNumber, currentUserId, methods.length]);

    // ─── Delete ───────────────────────────────────────────────────────────

    const handleDelete = useCallback((uid: string): void => {
        setConfirmDialog({
            visible: true,
            title: 'Remove Payment Method',
            message: 'Are you sure you want to remove this payment method?',
            onConfirm: () => {
                setConfirmDialog((d) => ({ ...d, visible: false }));
                void performDelete(uid);
            },
        });
    }, []);

    const performDelete = useCallback(async (uid: string): Promise<void> => {
        const { error } = await supabase.from('payment_methods').delete().eq('uid', uid);
        if (error !== null) {
            Alert.alert('Error', 'Failed to remove payment method.');
            return;
        }
        setMethods((prev) => {
            const remaining = prev.filter((m) => m.uid !== uid);
            const wasDefault = prev.find((m) => m.uid === uid)?.is_default ?? false;
            if (wasDefault && remaining.length > 0) {
                void setDefaultInDB(remaining[0].uid);
                return remaining.map((m, i) => ({ ...m, is_default: i === 0 }));
            }
            return remaining;
        });
    }, []);

    // ─── Set default ─────────────────────────────────────────────────────

    const handleSetDefault = useCallback((uid: string): void => {
        setMethods((prev) => prev.map((m) => ({ ...m, is_default: m.uid === uid })));
        void setDefaultInDB(uid);
    }, []);

    const setDefaultInDB = useCallback(async (uid: string): Promise<void> => {
        if (currentUserId === null) return;
        await supabase
            .from('payment_methods')
            .update({ is_default: false })
            .eq('user_id', currentUserId);
        await supabase
            .from('payment_methods')
            .update({ is_default: true })
            .eq('uid', uid);
    }, [currentUserId]);

    // ─── Render ───────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SafeScreen>
                <LoadingModal isVisible message="Loading payment methods…" />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} id="back-btn" style={styles.backBtn}>
                    <Text style={styles.backText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment Methods</Text>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setShowAddForm(true)}
                    id="add-payment-btn"
                >
                    <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={methods}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => (
                    <PaymentMethodCard
                        method={item}
                        onDelete={handleDelete}
                        onSetDefault={handleSetDefault}
                    />
                )}
                ListHeaderComponent={
                    showAddForm ? (
                        <View style={styles.formWrapper}>
                            <View style={styles.accountInputWrapper}>
                                <Text style={styles.inputLabel}>Account Number / Mobile Number</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={newAccountNumber}
                                    onChangeText={setNewAccountNumber}
                                    placeholder="e.g. 09123456789"
                                    placeholderTextColor={lightPalette.gray}
                                    keyboardType="phone-pad"
                                    id="new-account-number"
                                />
                            </View>
                            <AddPaymentForm
                                selectedType={newType}
                                accountNumber={newAccountNumber}
                                onTypeSelect={setNewType}
                                onAccountNumberChange={setNewAccountNumber}
                                onSubmit={() => { void handleSubmitAdd(); }}
                                onCancel={() => {
                                    setShowAddForm(false);
                                    setNewType(null);
                                    setNewAccountNumber('');
                                }}
                                isSubmitting={isSubmitting}
                            />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    !showAddForm ? (
                        <EmptyList
                            icon={<Text style={styles.emptyIcon}>💳</Text>}
                            message="No payment methods yet!"
                            submessage="Add a GCash or Maya account to enable checkout."
                            actionButton={{ label: 'Add Payment Method', onPress: () => setShowAddForm(true) }}
                        />
                    ) : null
                }
                contentContainerStyle={methods.length === 0 && !showAddForm ? { flex: 1 } : { paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            />

            {/* Confirm dialog */}
            <ConfirmDialog
                visible={confirmDialog.visible}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog((d) => ({ ...d, visible: false }))}
                confirmLabel="Remove"
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
    backBtn: { padding: 4 },
    backText: { fontSize: 17, color: lightPalette.primary, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: lightPalette.textPrimary },
    addBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: lightPalette.primary,
        borderRadius: 20,
    },
    addBtnText: { color: lightPalette.white, fontWeight: '800', fontSize: 14 },
    formWrapper: {
        paddingTop: 8,
    },
    accountInputWrapper: {
        paddingHorizontal: 16,
        marginBottom: -8,
        marginTop: 8,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: lightPalette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    textInput: {
        borderWidth: 1,
        borderColor: lightPalette.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: lightPalette.textPrimary,
        backgroundColor: lightPalette.cardBackground,
        marginBottom: 12,
    },
    emptyIcon: { fontSize: 40 },
});
