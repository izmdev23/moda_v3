import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeScreen } from '../../components/ui/safe-screen';
import { Animation } from '../../utils/animation';

import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { authApi } from '../../utils/database/auth';
import { lightPalette } from '../../utils/theme';

/**
 * Email verification landing screen shown when the user opens a magic link
 * or a deep-link redirect from a verification email.
 *
 * Flow:
 *  1. On mount, call `authApi.getSession()` to detect if Supabase automatically
 *     resolved the session from the deep link hash fragment.
 *  2. If session exists → navigate to home.
 *  3. If no session → show a friendly error with options to retry or go to login.
 *
 * This screen is registered at /auth/verify. The Supabase redirect URL in the
 * project dashboard should be set to `moda://auth/verify`.
 */
export default function VerifyScreen(): React.JSX.Element {
    const router = useRouter();


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
            router.replace('/(tabs)' as Parameters<typeof router.replace>[0]);
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
                    exiting={Animation.Presets.FadeOutUp}
                    style={styles.centered}>
                    <LoadingIndicator message="Verifying your email..." overlay={false} />
                </Animated.View>
            </SafeScreen>
        );
    }


    // Error state
    return (
        <SafeScreen>
            <Animated.View
                entering={Animation.Presets.FadeInDown}
                exiting={Animation.Presets.FadeOutUp}
                style={styles.centered}>

                <Text style={styles.errorIcon}>✉️</Text>

                <Text style={styles.title}>Verification Failed</Text>
                <Text style={styles.message}>{errorMessage}</Text>

                <TouchableOpacity style={styles.button} onPress={handleRetry} activeOpacity={0.8}>
                    <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleGoToOTP}
                    activeOpacity={0.7}
                >
                    <Text style={styles.secondaryButtonText}>Back to Login</Text>
                </TouchableOpacity>
            </Animated.View>
        </SafeScreen>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
        color: '#32325D',
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: '#525F7F',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 28,
    },
    button: {
        backgroundColor: lightPalette.primary,
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 14,
        width: '100%',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        paddingVertical: 10,
    },
    secondaryButtonText: {
        color: '#525F7F',
        fontSize: 14,
        fontWeight: '600',
    },
});
