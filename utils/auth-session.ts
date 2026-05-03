import { supabase } from '../supabase/supabaseClient';

const INVALID_REFRESH_TOKEN_PATTERNS: readonly string[] = [
    'invalid refresh token',
    'refresh token not found',
];

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return '';
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
    if (error === null || error === undefined) {
        return false;
    }

    const message = getErrorMessage(error).toLowerCase();
    if (message.length === 0) {
        return false;
    }

    for (const pattern of INVALID_REFRESH_TOKEN_PATTERNS) {
        if (message.includes(pattern)) {
            return true;
        }
    }

    return false;
}

export async function clearLocalSession(): Promise<void> {
    try {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error !== null) {
            console.warn('Local sign-out warning:', error.message);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown local sign-out error';
        console.warn('Failed to clear local session:', message);
    }
}
