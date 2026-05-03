import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase/supabaseClient';
import { queryKeys } from '../utils/query-keys';
import type { UserRole } from '../utils/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurrentUser {
    readonly id: number;
    readonly authId: string;
    readonly email: string;
    readonly avatarUrl: string | null;
    readonly role: UserRole;
}

function normalizeUserId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (trimmedValue === '' || trimmedValue === 'null' || trimmedValue === 'undefined') {
            return null;
        }

        const parsedValue = Number(trimmedValue);
        if (Number.isInteger(parsedValue) && Number.isFinite(parsedValue) && parsedValue > 0) {
            return parsedValue;
        }
    }

    return null;
}

// ─── Fetch fn ─────────────────────────────────────────────────────────────────

async function fetchCurrentUser(): Promise<CurrentUser | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;

    const { data } = await supabase
        .from('users')
        .select('id, avatar_url, role')
        .eq('auth_id', session.user.id)
        .single();

    if (!data) return null;

    const normalizedUserId = normalizeUserId(data.id);
    if (normalizedUserId === null) return null;

    return {
        id: normalizedUserId,
        authId: session.user.id,
        email: session.user.email ?? '',
        avatarUrl: data.avatar_url ?? null,
        role: data.role as UserRole,
    };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the currently authenticated user's profile row.
 *
 * Cached with `staleTime: Infinity` — the resolved user identity does not
 * change during a session. The cache is cleared automatically by `queryClient.clear()`
 * when the user signs out (see _layout.tsx auth state listener).
 *
 * Replaces the duplicated two-step pattern:
 *   `supabase.auth.getSession()` → `supabase.from('users').select('id').eq('auth_id', ...)`
 * that previously appeared in every page component.
 */
export function useCurrentUser(): UseQueryResult<CurrentUser | null, Error> {
    return useQuery({
        queryKey: queryKeys.currentUser,
        queryFn: fetchCurrentUser,
        staleTime: Infinity,
    });
}
