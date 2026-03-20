import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

// ─── React Native Focus Manager ───────────────────────────────────────────────
// TanStack Query's refetchOnWindowFocus translates to app foreground events
// on React Native. Subscribe once at module load; expo-router's _layout
// already manages AppState for Supabase session refresh, so we piggyback here.
AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
});

// ─── Query Client ─────────────────────────────────────────────────────────────

/**
 * Singleton QueryClient shared across the app.
 *
 * Stale-time rationale:
 *  - Default 2 min: products, reviews, shops (read-heavy, tolerate slight staleness)
 *  - Overridden per-query for cart (30 s) and user identity (Infinity)
 *
 * gcTime 10 min: keep inactive cache resident in memory for fast back-navigation.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 2 * 60 * 1000,  // 2 minutes
            gcTime: 10 * 60 * 1000,    // 10 minutes
            retry: 2,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
        },
    },
});
