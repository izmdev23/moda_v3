import { RipplePressable } from '@/components/ui/ripple-pressable';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
    StyleSheet, Text, View
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { Animation } from '../../utils/animation';

/**
 * Verification email screen shown after signup.
 * Informs the user that a verification link has been sent to their email.
 * Colors are sourced from the active theme via useTheme().
 *
 * Route params:
 *   - email: string — the address where the link was sent.
 */
export default function VerifyEmailScreen(): React.JSX.Element {
    const router = useRouter();
    const { theme } = useTheme();
    const { email } = useLocalSearchParams<{ email: string }>();

    const handleBackToLogin = (): void => {
        router.replace('/auth/login' as Parameters<typeof router.replace>[0]);
    };

    return (
        <SafeScreen>
            <Animated.View
                entering={Animation.Presets.FadeInDown}
                exiting={Animation.Presets.FadeOutDown}
                style={styles.content}
            >
                <View style={[styles.iconContainer, { backgroundColor: `${theme.primary}14`, shadowColor: theme.primary }]}>
                    <Text style={styles.icon}>📧</Text>
                </View>

                <Text style={[styles.title, { color: theme.textPrimary }]}>Confirm Your Email</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    We've sent a verification link to{'\n'}
                    <Text style={[styles.emailHighlight, { color: theme.primary }]}>{email || 'your email'}</Text>
                </Text>

                <View style={[styles.infoCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>What's next?</Text>
                    <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                        1. Open your email inbox.{'\n'}
                        2. Click the confirmation link.{'\n'}
                        3. Log in to your new account.
                    </Text>
                </View>

                <View style={styles.spacer} />

                <RipplePressable
                    style={[styles.primaryButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                    onPress={handleBackToLogin}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.primaryButtonText, { color: theme.white }]}>Back to Login</Text>
                </RipplePressable>

                <Text style={[styles.helpText, { color: theme.gray }]}>
                    Didn't receive the email? Check your spam folder or try logging in to resend the link.
                </Text>
            </Animated.View>
        </SafeScreen>
    );
}

// ─── Styles (layout & spacing only — NO color values) ─────────────────────────

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 32,
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    icon: {
        fontSize: 48,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    emailHighlight: {
        fontWeight: '700',
    },
    infoCard: {
        width: '100%',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 15,
        lineHeight: 26,
    },
    spacer: {
        flex: 1,
    },
    primaryButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    helpText: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 20,
    },
});
