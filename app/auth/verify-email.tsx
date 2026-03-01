import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeScreen } from '../../components/ui/safe-screen';
import { Animation } from '../../utils/animation';
import { lightPalette } from '../../utils/theme';

/**
 * Verification email screen shown after signup.
 * Informs the user that a verification link has been sent to their email.
 *
 * Route params:
 *   - email: string — the address where the link was sent.
 */
export default function VerifyEmailScreen(): React.JSX.Element {
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();

    const handleBackToLogin = (): void => {
        router.replace('/auth/login' as Parameters<typeof router.replace>[0]);
    };

    return (
        <SafeScreen>
            <Animated.View
                entering={Animation.Presets.FadeInDown}
                style={styles.content}
            >
                {/* Icon */}
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>📧</Text>
                </View>

                {/* Header */}
                <Text style={styles.title}>Confirm Your Email</Text>
                <Text style={styles.subtitle}>
                    We've sent a verification link to{'\n'}
                    <Text style={styles.emailHighlight}>{email || 'your email'}</Text>
                </Text>

                {/* Illustration / Info Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>What's next?</Text>
                    <Text style={styles.infoText}>
                        1. Open your email inbox.{'\n'}
                        2. Click the confirmation link.{'\n'}
                        3. Log in to your new account.
                    </Text>
                </View>

                {/* Spacer */}
                <View style={styles.spacer} />

                {/* Action Button */}
                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleBackToLogin}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryButtonText}>Back to Login</Text>
                </TouchableOpacity>

                {/* Help Text */}
                <Text style={styles.helpText}>
                    Didn't receive the email? Check your spam folder or try logging in to resend the link.
                </Text>
            </Animated.View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 32,
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFF5F4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        // Subtle shadow
        shadowColor: lightPalette.primary,
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
        color: '#32325D',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#525F7F',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    emailHighlight: {
        color: lightPalette.primary,
        fontWeight: '700',
    },
    infoCard: {
        width: '100%',
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#32325D',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 15,
        color: '#525F7F',
        lineHeight: 26,
    },
    spacer: {
        flex: 1,
    },
    primaryButton: {
        width: '100%',
        backgroundColor: lightPalette.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: lightPalette.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    helpText: {
        fontSize: 13,
        color: '#ADB5BD',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 20,
    },
});
