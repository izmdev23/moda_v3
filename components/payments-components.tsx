import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { lightPalette } from '../utils/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoredPaymentType = 'gcash' | 'paymaya';

export interface StoredPaymentMethod {
    readonly uid: string;
    readonly type: StoredPaymentType;
    readonly account_number: string;
    readonly is_default: boolean;
}

// ─── PaymentMethodCard ────────────────────────────────────────────────────────

interface PaymentMethodCardProps {
    readonly method: StoredPaymentMethod;
    readonly onDelete: (uid: string) => void;
    readonly onSetDefault: (uid: string) => void;
}

const PAYMENT_ICONS: Record<StoredPaymentType, string> = {
    gcash: '💙',
    paymaya: '💚',
};

const PAYMENT_LABELS: Record<StoredPaymentType, string> = {
    gcash: 'GCash',
    paymaya: 'Maya',
};

/**
 * Displays a saved payment method with masked account number,
 * options to set as default and delete.
 */
export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
    method,
    onDelete,
    onSetDefault,
}): React.JSX.Element => {
    const maskedNumber = maskAccountNumber(method.account_number);

    return (
        <View style={styles.card}>
            <View style={styles.cardLeft}>
                <Text style={styles.cardIcon}>{PAYMENT_ICONS[method.type]}</Text>
                <View>
                    <View style={styles.labelRow}>
                        <Text style={styles.cardLabel}>{PAYMENT_LABELS[method.type]}</Text>
                        {method.is_default && (
                            <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.cardNumber}>{maskedNumber}</Text>
                </View>
            </View>
            <View style={styles.cardActions}>
                {!method.is_default && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => onSetDefault(method.uid)}
                        id={`set-default-payment-${method.uid}`}
                    >
                        <Text style={styles.actionText}>Set Default</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => onDelete(method.uid)}
                    id={`delete-payment-${method.uid}`}
                >
                    <Text style={styles.deleteText}>Remove</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ─── AddPaymentForm ───────────────────────────────────────────────────────────

interface AddPaymentFormProps {
    readonly selectedType: StoredPaymentType | null;
    readonly accountNumber: string;
    readonly onTypeSelect: (type: StoredPaymentType) => void;
    readonly onAccountNumberChange: (value: string) => void;
    readonly onSubmit: () => void;
    readonly onCancel: () => void;
    readonly isSubmitting: boolean;
}

/**
 * Inline form for adding a new GCash/Maya account.
 * Type picker + account number input with submit/cancel actions.
 */
export const AddPaymentForm: React.FC<AddPaymentFormProps> = ({
    selectedType,
    accountNumber,
    onTypeSelect,
    onAccountNumberChange,
    onSubmit,
    onCancel,
    isSubmitting,
}): React.JSX.Element => {
    return (
        <View style={styles.form}>
            <Text style={styles.formTitle}>Add Payment Method</Text>

            <View style={styles.typeRow}>
                {(['gcash', 'paymaya'] as StoredPaymentType[]).map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={[styles.typeChip, selectedType === type && styles.typeChipSelected]}
                        onPress={() => onTypeSelect(type)}
                        id={`select-payment-type-${type}`}
                    >
                        <Text style={styles.typeChipIcon}>{PAYMENT_ICONS[type]}</Text>
                        <Text
                            style={[
                                styles.typeChipText,
                                selectedType === type && styles.typeChipTextSelected,
                            ]}
                        >
                            {PAYMENT_LABELS[type]}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Account Number / Mobile Number</Text>
                <View style={styles.textInputContainer}>
                    <Text style={styles.textInputInner}>{accountNumber}</Text>
                </View>
            </View>

            <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} id="cancel-add-payment">
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                    onPress={onSubmit}
                    disabled={isSubmitting}
                    id="submit-add-payment"
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color={lightPalette.white} />
                    ) : (
                        <Text style={styles.submitBtnText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const maskAccountNumber = (number: string): string => {
    if (number.length <= 4) return number;
    const visible = number.slice(-4);
    const masked = '*'.repeat(Math.max(number.length - 4, 4));
    return `${masked}${visible}`;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // PaymentMethodCard
    card: {
        backgroundColor: lightPalette.cardBackground,
        borderRadius: 14,
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 6,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 10,
    },
    cardIcon: {
        fontSize: 32,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    cardLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: lightPalette.textPrimary,
    },
    defaultBadge: {
        backgroundColor: lightPalette.primary,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    defaultBadgeText: {
        color: lightPalette.white,
        fontSize: 11,
        fontWeight: '700',
    },
    cardNumber: {
        fontSize: 14,
        color: lightPalette.textSecondary,
        letterSpacing: 1,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: lightPalette.border,
        backgroundColor: lightPalette.cardBackground,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
        color: lightPalette.textPrimary,
    },
    deleteBtn: {
        borderColor: lightPalette.error,
        backgroundColor: 'rgba(245,54,92,0.07)',
    },
    deleteText: {
        fontSize: 13,
        fontWeight: '600',
        color: lightPalette.error,
    },

    // AddPaymentForm
    form: {
        backgroundColor: lightPalette.cardBackground,
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 16,
        marginTop: 8,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    formTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: lightPalette.textPrimary,
        marginBottom: 16,
    },
    typeRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    typeChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: lightPalette.border,
        backgroundColor: lightPalette.background,
    },
    typeChipSelected: {
        borderColor: lightPalette.primary,
        backgroundColor: 'rgba(244,67,54,0.05)',
    },
    typeChipIcon: {
        fontSize: 18,
    },
    typeChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: lightPalette.textSecondary,
    },
    typeChipTextSelected: {
        color: lightPalette.primary,
        fontWeight: '700',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: lightPalette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    textInputContainer: {
        borderWidth: 1,
        borderColor: lightPalette.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: lightPalette.background,
    },
    textInputInner: {
        fontSize: 15,
        color: lightPalette.textPrimary,
    },
    formActions: {
        flexDirection: 'row',
        gap: 10,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: lightPalette.border,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: lightPalette.textSecondary,
    },
    submitBtn: {
        flex: 2,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: lightPalette.primary,
        alignItems: 'center',
    },
    submitBtnDisabled: {
        opacity: 0.6,
    },
    submitBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: lightPalette.white,
    },
});
