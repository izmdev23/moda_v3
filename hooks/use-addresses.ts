import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase/supabaseClient';
import { queryKeys } from '../utils/query-keys';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressRow {
    readonly id: number;
    readonly uid: string;
    readonly country: string;
    readonly province: string;
    readonly city: string;
    readonly barangay: string;
    readonly address_detail: string;
    readonly phone_number: string;
    readonly is_default: boolean;
}

// ─── Fetch fn ─────────────────────────────────────────────────────────────────

async function fetchAddresses(userId: number): Promise<AddressRow[]> {
    const { data, error } = await supabase
        .from('addresses')
        .select('id, uid, country, province, city, barangay, address_detail, phone_number, is_default')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as AddressRow[] | null) ?? [];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Query: fetches all addresses for the given user.
 * Stale after 5 minutes — addresses change rarely.
 *
 * After adding or updating an address call:
 *   `queryClient.invalidateQueries({ queryKey: queryKeys.addresses(userId) })`
 */
export function useAddresses(userId: number | null) {
    return useQuery({
        queryKey: queryKeys.addresses(userId ?? 0),
        queryFn: () => fetchAddresses(userId!),
        enabled: userId !== null,
        staleTime: 5 * 60 * 1000,
    });
}
