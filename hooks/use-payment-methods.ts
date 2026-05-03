import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/supabaseClient';
import { queryKeys } from '../utils/query-keys';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoredPaymentType = 'gcash' | 'paymaya' | 'card';

export interface StoredPaymentMethod {
    readonly uid: string;
    readonly type: StoredPaymentType;
    readonly account_number: string;
    readonly is_default: boolean;
}

interface ParsedCardAccount {
    readonly paymentMethodId: string | null;
    readonly last4: string | null;
}

const CARD_ACCOUNT_SEPARATOR = '|';
const LAST4_DIGITS_LENGTH = 4;
const LAST4_REGEX = /^\d{4}$/;

interface AddMethodPayload {
    userId: number;
    type: StoredPaymentType;
    accountNumber: string;
    isFirst: boolean;
}

export function encodeStoredCardAccountNumber(paymentMethodId: string, last4?: string | null): string {
    const sanitizedLast4 = (last4 ?? '').replace(/\D/g, '').slice(-LAST4_DIGITS_LENGTH);
    if (!paymentMethodId.startsWith('pm_')) {
        return paymentMethodId;
    }
    if (sanitizedLast4.length !== LAST4_DIGITS_LENGTH) {
        return paymentMethodId;
    }
    return `${paymentMethodId}${CARD_ACCOUNT_SEPARATOR}${sanitizedLast4}`;
}

export function parseStoredCardAccountNumber(accountNumber: string): ParsedCardAccount {
    if (!accountNumber.startsWith('pm_')) {
        return { paymentMethodId: null, last4: null };
    }

    const separatorIndex = accountNumber.lastIndexOf(CARD_ACCOUNT_SEPARATOR);
    if (separatorIndex <= 0) {
        return { paymentMethodId: accountNumber, last4: null };
    }

    const paymentMethodId = accountNumber.slice(0, separatorIndex);
    const last4 = accountNumber.slice(separatorIndex + 1);

    if (!paymentMethodId.startsWith('pm_') || !LAST4_REGEX.test(last4)) {
        return { paymentMethodId: accountNumber, last4: null };
    }

    return { paymentMethodId, last4 };
}

export function getStripePaymentMethodIdFromStoredAccount(accountNumber: string): string | null {
    return parseStoredCardAccountNumber(accountNumber).paymentMethodId;
}

// ─── Fetch fn ─────────────────────────────────────────────────────────────────

async function fetchPaymentMethods(userId: number): Promise<StoredPaymentMethod[]> {
    const { data, error } = await supabase
        .from('payment_methods')
        .select('uid, type, account_number, is_default')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => ({
        uid: d.uid,
        type: d.type as StoredPaymentType,
        account_number: d.account_number,
        is_default: d.is_default,
    }));
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Query: fetches saved payment methods for the given user.
 * Stale after 5 minutes — payment methods are infrequently changed.
 */
export function usePaymentMethods(userId: number | null) {
    return useQuery({
        queryKey: queryKeys.paymentMethods(userId ?? 0),
        queryFn: () => fetchPaymentMethods(userId!),
        enabled: userId !== null,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Mutation: insert a new GCash/Maya payment method.
 * Invalidates the payment methods list on success.
 */
export function useAddPaymentMethod() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, type, accountNumber, isFirst }: AddMethodPayload) => {
            const { data, error } = await supabase
                .from('payment_methods')
                .insert({
                    user_id: userId,
                    type,
                    account_number: accountNumber,
                    is_default: isFirst,
                })
                .select('uid, type, account_number, is_default')
                .single();

            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (_data, variables) => {
            void qc.invalidateQueries({ queryKey: queryKeys.paymentMethods(variables.userId) });
        },
    });
}

/**
 * Mutation: delete a payment method by UID.
 * Invalidates the list; the caller may need to promote a new default.
 */
export function useDeletePaymentMethod(userId: number | null) {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (uid: string) => {
            const { error } = await supabase
                .from('payment_methods')
                .delete()
                .eq('uid', uid);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            if (userId !== null) {
                void qc.invalidateQueries({ queryKey: queryKeys.paymentMethods(userId) });
            }
        },
    });
}

/**
 * Mutation: set a payment method as the default for a user.
 * Runs two sequential updates (clear all → set one) and invalidates the list.
 */
export function useSetDefaultPaymentMethod(userId: number | null) {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (uid: string) => {
            if (userId === null) throw new Error('No user ID');
            await supabase
                .from('payment_methods')
                .update({ is_default: false })
                .eq('user_id', userId);
            const { error } = await supabase
                .from('payment_methods')
                .update({ is_default: true })
                .eq('uid', uid);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            if (userId !== null) {
                void qc.invalidateQueries({ queryKey: queryKeys.paymentMethods(userId) });
            }
        },
    });
}
