import { AppAlertProvider } from '@/components/ui/app-alert-provider';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/components/ui/theme-provider';
import { UserRoleProvider } from '@/components/ui/user-role-context';
import { useSellerOrderNotifications } from '@/hooks/use-seller-order-notifications';
import { Animation } from '@/utils/animation';
import { ErrorBoundary } from '@/utils/errorBoundary';
import { queryClient } from '@/utils/query-client';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { supabase } from '@supabase/supabaseClient';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, LogBox } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ─── Constants ─────────────────────────────────────────────────────────────────

// Prevent the splash screen from auto-hiding before the app has fully loaded.
void SplashScreen.preventAutoHideAsync();

// Ignore specific development errors that are internal to Expo's dev tools
LogBox.ignoreLogs(['Unable to activate keep awake']);

const PREFETCH_ROUTES: readonly string[] = [
    '/home/catalog',
    '/home/cart',
    '/home/product-details',
    '/home/shop-landing',
    '/home/checkout',
    '/home/chat',
    '/home/chat-thread',
];

interface RouterPrefetchApi {
    readonly prefetch?: (href: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const unstable_settings = {
    anchor: '(tabs)',
};

function RootNavigationContent(): React.JSX.Element {
    const { isDark } = useTheme();
    useSellerOrderNotifications();

    return (
        <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: Animation.DefaultAnimationSpeed,
                }}
            >
                {/* Auth group */}
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="auth/login" options={{ headerShown: false }} />
                <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
                <Stack.Screen name="auth/otp" options={{ headerShown: false }} />
                <Stack.Screen name="auth/verify" options={{ headerShown: false }} />
                <Stack.Screen name="auth/verify-email" options={{ headerShown: false }} />

                {/* Home group (tab + stack screens) */}
                <Stack.Screen name="home" options={{ headerShown: false }} />

                {/* Legacy tabs entry point */}
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

                {/* Modal */}
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style={isDark ? 'light' : 'dark'} />
        </NavigationThemeProvider>
    );
}

/**
 * RootLayout
 *
 * Application root. Bootstraps providers (theme, auth, Stripe, safe area,
 * error boundary) and controls the navigation stack. Handles:
 *   - Splash screen: shown until session check resolves
 *   - Auth state changes: redirect to login on session expiry
 *   - Deep links: moda://product/<uid> → /home/product-details?uid=<uid>
 *                 moda://shop/<uid>    → /home/shop-landing?uid=<uid>
 *   - Token auto-refresh on app foreground/background transitions
 *
 * @example
 * // Deep link from external source
 * Linking.openURL('moda://product/abc-123');
 * // → navigates to /home/product-details?uid=abc-123
 */
export default function RootLayout(): React.ReactNode {
    const [publishableKey, setPublishableKey] = useState<string>('');
    const [appReady, setAppReady] = useState<boolean>(false);
    const splashHidden = useRef<boolean>(false);

    // ── Stripe key fetch ──────────────────────────────────────────────────────
    useEffect(() => {
        const fetchStripeKey = async (): Promise<void> => {
            try {
                const { data, error } = await supabase.functions.invoke('payment-config');
                if (error) throw error;
                if (data?.publishableKey as string | undefined) {
                    setPublishableKey(data.publishableKey as string);
                }
            } catch (e) {
                console.error('Failed to fetch Stripe key from edge function:', e);
            }
        };
        void fetchStripeKey();
    }, []);

    // ── Auth + splash orchestration ───────────────────────────────────────────
    useEffect(() => {
        const checkSession = async (): Promise<void> => {
            // Just check that getSession resolves — routing is handled by index.tsx
            await supabase.auth.getSession();
            setAppReady(true);
        };
        void checkSession();

        // Listen for auth state changes: redirect to login when signed out.
        // Clear the query cache on sign-out so stale user data never leaks
        // into the next session.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                queryClient.clear();
                router.replace('/auth/login');
            }
        });

        // React Native requires explicit start/stop of auto-refresh on app
        // focus changes. Without this, the refresh timer stops when the app
        // goes to background and the token can expire before the next refresh.
        const appStateSubscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                void supabase.auth.startAutoRefresh();
            } else {
                void supabase.auth.stopAutoRefresh();
            }
        });

        return (): void => {
            subscription.unsubscribe();
            appStateSubscription.remove();
        };
    }, []);

    // ── Splash screen: hide once app is ready ─────────────────────────────────
    useEffect(() => {
        if (appReady && !splashHidden.current) {
            splashHidden.current = true;
            void SplashScreen.hideAsync();
        }
    }, [appReady]);

    useEffect(() => {
        if (!appReady || __DEV__) return;

        const routerWithPrefetch = router as unknown as RouterPrefetchApi;
        for (const route of PREFETCH_ROUTES) {
            routerWithPrefetch.prefetch?.(route);
        }
    }, [appReady]);

    // ── Deep link handler ─────────────────────────────────────────────────────
    useEffect(() => {
        const handleUrl = (url: string): void => {
            // moda://product/<uid>
            const productMatch = /^moda:\/\/product\/([^/?#]+)/.exec(url);
            if (productMatch?.[1]) {
                router.push(`/home/product-details?uid=${productMatch[1]}`);
                return;
            }
            // moda://shop/<uid>
            const shopMatch = /^moda:\/\/shop\/([^/?#]+)/.exec(url);
            if (shopMatch?.[1]) {
                router.push(`/home/shop-landing?uid=${shopMatch[1]}`);
            }
        };

        // Handle the URL that launched the app (cold start deep link)
        void Linking.getInitialURL().then((url) => {
            if (url) handleUrl(url);
        });

        // Handle deep links while the app is already running
        const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
        return (): void => subscription.remove();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
        <StripeProvider
            publishableKey={publishableKey}
            merchantIdentifier="merchant.app.moda"
        >
            <SafeAreaProvider>
                <ErrorBoundary>
                    <AppThemeProvider>
                        <AppAlertProvider>
                            <UserRoleProvider>
                                <RootNavigationContent />
                            </UserRoleProvider>
                        </AppAlertProvider>
                    </AppThemeProvider>
                </ErrorBoundary>
            </SafeAreaProvider>
        </StripeProvider>
        </QueryClientProvider>
    );
}
