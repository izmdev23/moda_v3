import { RipplePressable } from '@/components/ui/ripple-pressable';
import { supabase } from '@/supabase/supabaseClient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeScreen } from '../../components/ui/safe-screen';
import { Animation } from '../../utils/animation';

import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { useTheme } from '../../components/ui/theme-provider';
import { authApi } from '../../utils/database/auth';

function normalizeUserRole(role: unknown): string {
    if (typeof role !== 'string') return '';
    return role.trim().toLowerCase();
}

/**
 * Email verification landing screen — shown when the user opens a magic link
 * or a deep-link redirect from a verification email.
 * Colors are sourced from the active theme via useTheme().
 */
export default function VerifyScreen(): React.JSX.Element {
    const router = useRouter();
    const { theme } = useTheme();

    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        void checkSession();
    }, []);

    const checkSession = async (): Promise<void> => {
        setStatus('loading');
        const { data, error } = await authApi.getSession();

        if (error) {
            setStatus('error');
            setErrorMessage('Could not retrieve session. Please try again.');
            return;
        }

        if (data.session) {
            setStatus('success');

            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('auth_id', data.session.user.id)
                .single();

            const normalizedRole = normalizeUserRole(userData?.role);
            const targetRoute = normalizedRole === 'seller' ? '/home/seller-dashboard' : '/home/catalog';

            if (router.canDismiss()) {
                router.dismissAll();
            }

            router.replace(targetRoute as Parameters<typeof router.replace>[0]);
        } else {
            setStatus('error');
            setErrorMessage(
                'Verification link has expired or is invalid. Please request a new code.'
            );
        }
    };

    const handleGoToOTP = (): void => {
        router.replace('/auth/login' as Parameters<typeof router.replace>[0]);
    };

    const handleRetry = (): void => {
        void checkSession();
    };

    if (status === 'loading' || status === 'success') {
        return (
            <SafeScreen>
                <Animated.View
                    entering={Animation.Presets.FadeInDown}
                    exiting={Animation.Presets.FadeOutDown}
                    style={styles.centered}>
                    <LoadingIndicator message="Verifying your email..." overlay={false} />
                </Animated.View>
            </SafeScreen>
        );
    }

    return (
        <SafeScreen>
            <Animated.View
                entering={Animation.Presets.FadeInDown}
                exiting={Animation.Presets.FadeOutDown}
                style={styles.centered}>

                <Text style={styles.errorIcon}>✉️</Text>

                <Text style={[styles.title, { color: theme.textPrimary }]}>Verification Failed</Text>
                <Text style={[styles.message, { color: theme.textSecondary }]}>{errorMessage}</Text>

                <RipplePressable
                    style={[styles.button, { backgroundColor: theme.primary }]}
                    onPress={handleRetry}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.buttonText, { color: theme.white }]}>Try Again</Text>
                </RipplePressable>

                <RipplePressable
                    style={styles.secondaryButton}
                    onPress={handleGoToOTP}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Back to Login</Text>
                </RipplePressable>
            </Animated.View>
        </SafeScreen>
    );
}

// ─── Styles (layout & spacing only — NO color values) ─────────────────────────

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 14,
        width: '100%',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        paddingVertical: 10,
    },
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
