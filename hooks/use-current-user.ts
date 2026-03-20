import { useQuery } from '@tanstack/react-query';
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

    return {
        id: data.id,
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
export function useCurrentUser() {
    return useQuery({
        queryKey: queryKeys.currentUser,
        queryFn: fetchCurrentUser,
        staleTime: Infinity,
    });
}
