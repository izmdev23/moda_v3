import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase/supabaseClient';
import { clearLocalSession, isInvalidRefreshTokenError } from '../utils/auth-session';
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
    let session: { user?: { id?: string; email?: string | null } } | null = null;

    try {
        const sessionResult = await supabase.auth.getSession();
        session = sessionResult.data.session;

        if (sessionResult.error !== null) {
            if (isInvalidRefreshTokenError(sessionResult.error)) {
                await clearLocalSession();
                return null;
            }

            console.warn('fetchCurrentUser session warning:', sessionResult.error.message);
            return null;
        }
    } catch (error) {
        if (isInvalidRefreshTokenError(error)) {
            await clearLocalSession();
            return null;
        }

        const message = error instanceof Error ? error.message : 'Unknown session error';
        console.warn('fetchCurrentUser session failed:', message);
        return null;
    }

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
 * Configured to refetch aggressively (`staleTime: 0`, `refetchOnMount: 'always'`)
 * so user-scoped data stays correct when auth state changes across devices.
 * The cache is also cleared by `queryClient.clear()` on auth transitions
 * (see _layout.tsx auth state listener).
 *
 * Replaces the duplicated two-step pattern:
 *   `supabase.auth.getSession()` → `supabase.from('users').select('id').eq('auth_id', ...)`
 * that previously appeared in every page component.
 */
export function useCurrentUser(): UseQueryResult<CurrentUser | null, Error> {
    return useQuery({
        queryKey: queryKeys.currentUser,
        queryFn: fetchCurrentUser,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    });
}
