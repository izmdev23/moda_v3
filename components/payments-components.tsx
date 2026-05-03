import { RipplePressable } from '@/components/ui/ripple-pressable';
import { CardForm, useStripe } from '@stripe/stripe-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { encodeStoredCardAccountNumber, parseStoredCardAccountNumber } from '../hooks/use-payment-methods';
import { useTheme } from './ui/theme-provider';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoredPaymentType = 'gcash' | 'paymaya' | 'card';

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
    card: '💳',
};

const PAYMENT_LABELS: Record<StoredPaymentType, string> = {
    gcash: 'GCash (Unavailable)',
    paymaya: 'Maya',
    card: 'Card',
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
    const { theme } = useTheme();
    const maskedNumber = maskAccountNumber(method.type, method.account_number);

    return (
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.cardLeft}>
                <Text style={styles.cardIcon}>{PAYMENT_ICONS[method.type]}</Text>
                <View>
                    <View style={styles.labelRow}>
                        <Text style={[styles.cardLabel, { color: theme.textPrimary }]}>{PAYMENT_LABELS[method.type]}</Text>
                        {method.is_default && (
                            <View style={[styles.defaultBadge, { backgroundColor: theme.primary }]}>
                                <Text style={[styles.defaultBadgeText, { color: theme.white }]}>Default</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.cardNumber, { color: theme.textSecondary }]}>{maskedNumber}</Text>
                </View>
            </View>
            <View style={styles.cardActions}>
                {!method.is_default && (
                    <RipplePressable
                        style={[styles.actionBtn, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                        onPress={() => onSetDefault(method.uid)}
                        id={`set-default-payment-${method.uid}`}
                    >
                        <Text style={[styles.actionText, { color: theme.textPrimary }]}>Set Default</Text>
                    </RipplePressable>
                )}
                <RipplePressable
                    style={[styles.actionBtn, { borderColor: theme.error, backgroundColor: `${theme.error}12` }]}
                    onPress={() => onDelete(method.uid)}
                    id={`delete-payment-${method.uid}`}
                >
                    <Text style={[styles.deleteText, { color: theme.error }]}>Remove</Text>
                </RipplePressable>
            </View>
        </View>
    );
};

// ─── AddCardForm ──────────────────────────────────────────────────────────────

interface AddCardFormProps {
    readonly onSubmit: (storedCardAccountNumber: string) => void;
    readonly onCancel: () => void;
    readonly isSubmitting: boolean;
}

interface CardFormDetailsLike {
    readonly complete?: boolean;
    readonly last4?: string | null;
}

interface CardFormEventLike {
    readonly nativeEvent?: {
        readonly card?: CardFormDetailsLike;
    };
}

/**
 * Inline form for adding a new credit/debit card.
 * Uses Stripe's CardField for PCI-compliant tokenization.
 */
export const AddCardForm: React.FC<AddCardFormProps> = ({
    onSubmit,
    onCancel,
    isSubmitting,
}): React.JSX.Element => {
    const { theme } = useTheme();
    const { createPaymentMethod } = useStripe();
    const [isCardComplete, setIsCardComplete] = React.useState<boolean>(false);
    const [cardError, setCardError] = React.useState<string | null>(null);
    const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
    const [cardLast4FromForm, setCardLast4FromForm] = React.useState<string | null>(null);

    const getCardFormDetails = (payload: unknown): CardFormDetailsLike => {
        const direct = payload as CardFormDetailsLike;
        if (direct !== null && typeof direct === 'object' && ('complete' in direct || 'last4' in direct)) {
            return direct;
        }

        const eventPayload = payload as CardFormEventLike;
        if (eventPayload?.nativeEvent?.card !== undefined) {
            return eventPayload.nativeEvent.card;
        }

        return {};
    };

    const handleSave = async () => {
        if (!isCardComplete) {
            setCardError('Please complete all card details.');
            return;
        }
        setCardError(null);
        setIsProcessing(true);
        
        const { paymentMethod, error } = await createPaymentMethod({
            paymentMethodType: 'Card',
        });

        setIsProcessing(false);

        if (error) {
            setCardError(error.message);
            return;
        }

        if (paymentMethod) {
            const sanitizedLast4FromForm = (cardLast4FromForm ?? '').replace(/\D/g, '').slice(-4);
            const storedCardAccountNumber = encodeStoredCardAccountNumber(
                paymentMethod.id,
                paymentMethod.card?.last4 ?? (sanitizedLast4FromForm.length === 4 ? sanitizedLast4FromForm : null)
            );
            onSubmit(storedCardAccountNumber);
        }
    };

    return (
        <View style={[styles.form, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.formTitle, { color: theme.textPrimary }]}>Add Credit/Debit Card</Text>

            <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Card Details <Text style={{ color: theme.error }}>*</Text>
                </Text>
                <CardForm
                    cardStyle={{
                        backgroundColor: theme.background,
                        textColor: theme.textPrimary,
                        placeholderColor: theme.textSecondary,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: theme.border,
                    }}
                    style={{
                        width: '100%',
                        height: 330,
                        marginVertical: 10,
                    }}
                    onFormComplete={(cardDetails: unknown) => {
                        const details = getCardFormDetails(cardDetails);
                        const isComplete = details.complete === true;
                        const formLast4Raw = typeof details.last4 === 'string' ? details.last4 : '';
                        const formLast4 = formLast4Raw.replace(/\D/g, '').slice(-4);

                        setIsCardComplete(isComplete);
                        setCardLast4FromForm(formLast4.length === 4 ? formLast4 : null);

                        if (isComplete) {
                            setCardError(null);
                        }
                    }}
                />
                {cardError !== null && (
                    <Text style={{ color: theme.error, fontSize: 13, marginTop: 4 }}>{cardError}</Text>
                )}
            </View>

            <View style={styles.formActions}>
                <RipplePressable style={[styles.cancelBtn, { backgroundColor: theme.border }]} onPress={onCancel} id="cancel-add-card">
                    <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </RipplePressable>
                <RipplePressable
                    style={[styles.submitBtn, { backgroundColor: theme.primary }, (isSubmitting || isProcessing) && styles.submitBtnDisabled]}
                    onPress={() => { void handleSave(); }}
                    disabled={isSubmitting || isProcessing}
                    id="submit-add-card"
                >
                    {(isSubmitting || isProcessing) ? (
                        <ActivityIndicator size="small" color={theme.white} />
                    ) : (
                        <Text style={[styles.submitBtnText, { color: theme.white }]}>Next</Text>
                    )}
                </RipplePressable>
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
    const { theme } = useTheme();

    return (
        <View style={[styles.form, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.formTitle, { color: theme.textPrimary }]}>Add e-Wallet Details</Text>

            <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Account Number / Mobile Number <Text style={{ color: theme.error }}>*</Text>
                </Text>
                <TextInput
                    style={[
                        styles.textInputContainer,
                        styles.textInputInner,
                        { borderColor: theme.border, backgroundColor: theme.background, color: theme.textPrimary }
                    ]}
                    value={accountNumber}
                    onChangeText={onAccountNumberChange}
                    placeholder="e.g. 09123456789"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                    maxLength={11}
                    id="add-payment-account-number"
                />
            </View>

            <View style={styles.formActions}>
                <RipplePressable style={[styles.cancelBtn, { backgroundColor: theme.border }]} onPress={onCancel} id="cancel-add-payment">
                    <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </RipplePressable>
                <RipplePressable
                    style={[styles.submitBtn, { backgroundColor: theme.primary }, isSubmitting && styles.submitBtnDisabled]}
                    onPress={onSubmit}
                    disabled={isSubmitting}
                    id="submit-add-payment"
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color={theme.white} />
                    ) : (
                        <Text style={[styles.submitBtnText, { color: theme.white }]}>Next</Text>
                    )}
                </RipplePressable>
            </View>
        </View>
    );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const maskAccountNumber = (type: StoredPaymentType, number: string): string => {
    if (type === 'card') {
        const { last4 } = parseStoredCardAccountNumber(number);
        return `•••• •••• •••• ${last4 ?? '••••'}`;
    }
    if (number.length <= 4) return number;
    const visible = number.slice(-4);
    const masked = '*'.repeat(Math.max(number.length - 4, 4));
    return `${masked}${visible}`;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // PaymentMethodCard
    card: {
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
    },
    defaultBadge: {
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    defaultBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    cardNumber: {
        fontSize: 14,
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
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
    },
    deleteText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // AddPaymentForm
    form: {
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
    },
    typeChipIcon: {
        fontSize: 18,
    },
    typeChipText: {
        fontSize: 14,
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    textInputContainer: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    textInputInner: {
        fontSize: 15,
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
    submitBtnDisabled: {
        opacity: 0.6,
    },
    submitBtnText: {
        fontSize: 14,
        fontWeight: '800',
    },
});
