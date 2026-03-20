import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import {
    AddCardForm,
    AddPaymentForm,
    PaymentMethodCard,
} from '../../components/payments-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import type { StoredPaymentMethod, StoredPaymentType } from '../../hooks/use-payment-methods';
import { useAddPaymentMethod, useDeletePaymentMethod, usePaymentMethods, useSetDefaultPaymentMethod } from '../../hooks/use-payment-methods';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_NUMBER_REGEX = /^[0-9+\-\s]{7,20}$/;

// ─── Payments Skeleton ────────────────────────────────────────────────────────

const PaymentMethodSkeleton: React.FC = () => (
    <View style={paymentsSkeletonStyles.item}>
        <SkeletonLoader width={52} height={52} borderRadius={10} />
        <View style={paymentsSkeletonStyles.itemBody}>
            <SkeletonLoader height={14} width="55%" style={{ marginBottom: 8 }} />
            <SkeletonLoader height={12} width="40%" />
        </View>
    </View>
);

const PaymentsSkeleton: React.FC = () => (
    <View style={paymentsSkeletonStyles.container}>
        {Array.from({ length: 3 }).map((_, i) => <PaymentMethodSkeleton key={i} />)}
    </View>
);

const paymentsSkeletonStyles = StyleSheet.create({
    container: { paddingTop: 8 },
    item: { flexDirection: 'row', padding: 16, gap: 14, alignItems: 'center' },
    itemBody: { flex: 1 },
});

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PaymentsScreen — lists all saved GCash/Maya accounts with add/remove/set-default controls.
 * Uses AddPaymentForm inline and ConfirmDialog on destructive actions.
 */
export default function PaymentsScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

    const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
    const userId = currentUser?.id ?? null;

    const { data: methods = [], isLoading: isMethodsLoading } = usePaymentMethods(userId);
    const addMethodMutation = useAddPaymentMethod();
    const deleteMethodMutation = useDeletePaymentMethod(userId);
    const setDefaultMutation = useSetDefaultPaymentMethod(userId);

    const isLoading = isUserLoading || isMethodsLoading;

    const [showAddForm, setShowAddForm] = useState<boolean>(false);

    // Add form local state
    const [newType, setNewType] = useState<StoredPaymentType | null>(null);
    const [newAccountNumber, setNewAccountNumber] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Wizard state
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
    const [tempPaymentMethodId, setTempPaymentMethodId] = useState<string | null>(null);
    const [confirmSaveDialog, setConfirmSaveDialog] = useState<boolean>(false);

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ visible: false, title: '', message: '', onConfirm: () => undefined });

    // ─── Add payment method ───────────────────────────────────────────────

    const handleSubmitAdd = useCallback(async (): Promise<void> => {
        if (newType === null || newType === 'card') {
            Alert.alert('Select Type', 'Please choose GCash or Maya.');
            return;
        }
        if (!ACCOUNT_NUMBER_REGEX.test(newAccountNumber.trim())) {
            Alert.alert('Invalid Number', 'Please enter a valid mobile/account number (7–20 digits).');
            return;
        }
        if (userId === null) return;

        setIsSubmitting(true);
        addMethodMutation.mutate({
            userId,
            type: newType,
            accountNumber: newAccountNumber.trim(),
            isFirst: methods.length === 0,
        }, {
            onSuccess: () => {
                setShowAddForm(false);
                setNewType(null);
                setNewAccountNumber('');
                setWizardStep(1);
                if (returnTo === 'checkout') router.back();
            },
            onError: () => {
                Alert.alert('Error', 'Failed to save payment method. Please try again.');
            },
            onSettled: () => setIsSubmitting(false),
        });
    }, [newType, newAccountNumber, userId, methods.length, returnTo, addMethodMutation]);

    const handleAddCard = useCallback((paymentMethodId: string): void => {
        if (userId === null) return;

        setIsSubmitting(true);
        addMethodMutation.mutate({
            userId,
            type: 'card',
            accountNumber: paymentMethodId,
            isFirst: methods.length === 0,
        }, {
            onSuccess: () => {
                setShowAddForm(false);
                setNewType(null);
                setWizardStep(1);
                setTempPaymentMethodId(null);
                if (returnTo === 'checkout') router.back();
            },
            onError: () => {
                Alert.alert('Error', 'Failed to save card. Please try again.');
            },
            onSettled: () => setIsSubmitting(false),
        });
    }, [userId, methods.length, returnTo, addMethodMutation]);

    // ─── Delete ───────────────────────────────────────────────────────────

    const handleDelete = useCallback((uid: string): void => {
        setConfirmDialog({
            visible: true,
            title: 'Remove Payment Method',
            message: 'Are you sure you want to remove this payment method?',
            onConfirm: () => {
                setConfirmDialog((d) => ({ ...d, visible: false }));
                deleteMethodMutation.mutate(uid, {
                    onError: () => Alert.alert('Error', 'Failed to remove payment method.'),
                });
            },
        });
    }, [deleteMethodMutation]);

    // ─── Set default ─────────────────────────────────────────────────────

    const handleSetDefault = useCallback((uid: string): void => {
        setDefaultMutation.mutate(uid, {
            onError: () => Alert.alert('Error', 'Failed to set default payment method.'),
        });
    }, [setDefaultMutation]);

    // ─── Render ───────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <SafeScreen style={styles.root}>
                <PaymentsSkeleton />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={styles.root}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <TouchableOpacity onPress={() => router.back()} id="back-btn" style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.primary }]}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Payment Methods</Text>
            </View>

            <FlatList
                data={methods}
                keyExtractor={(item: StoredPaymentMethod) => item.uid}
                renderItem={({ item }) => (
                    <PaymentMethodCard
                        method={item}
                        onDelete={handleDelete}
                        onSetDefault={handleSetDefault}
                    />
                )}
                ListHeaderComponent={null}
                ListEmptyComponent={
                    !showAddForm ? (
                        <EmptyList
                            icon={<Text style={styles.emptyIcon}>💳</Text>}
                            message="No payment methods yet!"
                            submessage="Add a GCash, Maya, or Card to enable checkout."
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
            {/* Floating Add Button */}
            {!showAddForm && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: theme.primary }]}
                    onPress={() => setShowAddForm(true)}
                    id="fab-add-payment-btn"
                >
                    <Text style={[styles.fabText, { color: theme.white }]}>+</Text>
                </TouchableOpacity>
            )}

            {/* Add Payment Modal */}
            <Modal
                visible={showAddForm}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setShowAddForm(false);
                    setNewType(null);
                    setNewAccountNumber('');
                    setWizardStep(1);
                    setTempPaymentMethodId(null);
                }}
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.formTitle, { color: theme.textPrimary, marginBottom: 0 }]}>Add Payment Method</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowAddForm(false);
                                    setNewType(null);
                                    setNewAccountNumber('');
                                    setWizardStep(1);
                                    setTempPaymentMethodId(null);
                                }}
                            >
                                <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        {wizardStep === 1 && (
                            <View style={styles.formWrapper}>
                                <View style={[styles.typeSelectionCard, { backgroundColor: theme.cardBackground }]}>
                                    <Text style={[styles.formTitle, { color: theme.textPrimary, fontSize: 15 }]}>Step 1: Choose Payment Type</Text>
                                    <View style={styles.typeRow}>
                                        {(['gcash', 'paymaya', 'card'] as StoredPaymentType[]).map((type) => {
                                            const labels: Record<StoredPaymentType, string> = { gcash: 'GCash', paymaya: 'Maya', card: 'Card' };
                                            const isDisabled = type === 'gcash';
                                            return (
                                                <TouchableOpacity
                                                    key={type}
                                                    style={[
                                                        styles.typeChip,
                                                        { borderColor: theme.border, backgroundColor: theme.background },
                                                        newType === type && { borderColor: theme.primary, backgroundColor: `${theme.primary}0D` },
                                                        isDisabled && { opacity: 0.5, backgroundColor: theme.border + '1A' }
                                                    ]}
                                                    onPress={() => !isDisabled && setNewType(type)}
                                                    id={`select-payment-type-${type}`}
                                                    disabled={isDisabled}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.typeChipText,
                                                            { color: newType === type ? theme.primary : (isDisabled ? theme.gray : theme.textSecondary) },
                                                            newType === type && { fontWeight: '700' }
                                                        ]}
                                                    >
                                                        {labels[type]}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    <View style={[styles.formActions, { marginTop: 16 }]}>
                                        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.border }]} onPress={() => {
                                            setShowAddForm(false);
                                            setNewType(null);
                                            setWizardStep(1);
                                        }}>
                                            <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.submitBtn, { backgroundColor: theme.primary }, newType === null && styles.submitBtnDisabled]}
                                            onPress={() => {
                                                if (newType !== null) setWizardStep(2);
                                            }}
                                            disabled={newType === null}
                                        >
                                            <Text style={[styles.submitBtnText, { color: theme.white }]}>Next</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}

                        {wizardStep === 2 && (
                            <ScrollView
                                style={[styles.formWrapper, { flexShrink: 1, width: '100%' }]}
                                contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
                                showsVerticalScrollIndicator={true}
                                keyboardShouldPersistTaps="handled"
                            >
                                {newType === 'card' ? (
                                    <AddCardForm
                                        onSubmit={(pmId) => {
                                            setTempPaymentMethodId(pmId);
                                            setWizardStep(3);
                                        }}
                                        onCancel={() => {
                                            setWizardStep(1);
                                        }}
                                        isSubmitting={isSubmitting}
                                    />
                                ) : newType !== null ? (
                                    <AddPaymentForm
                                        selectedType={newType}
                                        accountNumber={newAccountNumber}
                                        onTypeSelect={setNewType}
                                        onAccountNumberChange={setNewAccountNumber}
                                        onSubmit={() => {
                                            if (!ACCOUNT_NUMBER_REGEX.test(newAccountNumber.trim())) {
                                                Alert.alert('Invalid Number', 'Please enter a valid mobile/account number (7–20 digits).');
                                                return;
                                            }
                                            setWizardStep(3);
                                        }}
                                        onCancel={() => {
                                            setWizardStep(1);
                                        }}
                                        isSubmitting={isSubmitting}
                                    />
                                ) : null}
                            </ScrollView>
                        )}

                        {wizardStep === 3 && (
                            <View style={styles.formWrapper}>
                                <View style={[styles.typeSelectionCard, { backgroundColor: theme.cardBackground }]}>
                                    <Text style={[styles.formTitle, { color: theme.textPrimary, fontSize: 16 }]}>Step 3: Summary</Text>

                                    <View style={{ marginBottom: 16 }}>
                                        <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Payment Type</Text>
                                        <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '600' }}>
                                            {newType === 'card' ? 'Credit/Debit Card' : newType === 'gcash' ? 'GCash' : 'Maya'}
                                        </Text>
                                    </View>

                                    {newType !== 'card' && (
                                        <View style={{ marginBottom: 16 }}>
                                            <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Account Number</Text>
                                            <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '600' }}>{newAccountNumber}</Text>
                                        </View>
                                    )}
                                    {newType === 'card' && (
                                        <View style={{ marginBottom: 16 }}>
                                            <Text style={{ color: theme.textSecondary, marginBottom: 4 }}>Details</Text>
                                            <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '600' }}>Card securely vaulted.</Text>
                                        </View>
                                    )}

                                    <View style={[styles.formActions, { marginTop: 8 }]}>
                                        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.border }]} onPress={() => setWizardStep(2)}>
                                            <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Back</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.submitBtn, { backgroundColor: theme.primary }]}
                                            onPress={() => setConfirmSaveDialog(true)}
                                        >
                                            <Text style={[styles.submitBtnText, { color: theme.white }]}>Save</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            <ConfirmDialog
                visible={confirmSaveDialog}
                title="Confirm Save"
                message="Are you sure you want to save this new payment method?"
                onConfirm={() => {
                    setConfirmSaveDialog(false);
                    if (newType === 'card' && tempPaymentMethodId) {
                        handleAddCard(tempPaymentMethodId);
                    } else {
                        void handleSubmitAdd();
                    }
                }}
                onCancel={() => setConfirmSaveDialog(false)}
                confirmLabel="Save"
                cancelLabel="Cancel"
                variant="info"
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
    backBtn: { padding: 4 },
    backText: { fontSize: 17, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    submitBtnDisabled: {
        opacity: 0.6,
    },
    addBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
    },
    addBtnText: { fontWeight: '800', fontSize: 14 },
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
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        marginBottom: 12,
    },
    emptyIcon: { fontSize: 40 },
    typeSelectionCard: {
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 8,
    },
    formTitle: {
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 16,
    },
    typeRow: {
        flexDirection: 'column',
        gap: 10,
    },
    typeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 2,
    },
    typeChipText: {
        fontSize: 16,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    fabText: {
        fontSize: 32,
        fontWeight: '300',
        marginTop: -4,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        borderRadius: 20,
        padding: 20,
        width: '90%',
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    formActions: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    submitBtn: {
        flex: 2,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    submitBtnText: {
        fontSize: 14,
        fontWeight: '800',
    },
});
