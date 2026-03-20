import { supabase } from '@/supabase/supabaseClient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeScreen } from '../../components/ui/safe-screen';
import { Animation } from '../../utils/animation';

import { OTPExpiryTimer, OTPInput, OTPResendButton } from '../../components/otp-components';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { useTheme } from '../../components/ui/theme-provider';
import { OTP_EXPIRY_SECONDS, OTP_LENGTH, SUPABASE_EMAIL_RATE_LIMIT } from '../../utils/constants';
import { authApi } from '../../utils/database/auth';

// ─── Constants ────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN_SECONDS = 60;
const MAGIC_LINK_URL = 'https://moda.example.com/magic'; // Placeholder

/**
 * OTP verification screen shown after signup or when the user requests
 * email verification. Accepts a 6-digit code, enforces Supabase's email
 * rate limit, provides a 5-minute OTP expiry countdown, and offers a
 * magic link fallback.
 *
 * Route params:
 *   - email: string — the address to verify
 *
 * On success: navigates to the home catalog.
 * Colors are sourced from the active theme via useTheme().
 */
export default function OTPScreen(): React.JSX.Element {
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();
    const { theme } = useTheme();

    const [otpCode, setOtpCode] = useState<string>('');
    const [isVerifying, setIsVerifying] = useState<boolean>(false);
    const [hasError, setHasError] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const [resendCooldown, setResendCooldown] = useState<number>(0);
    const [resendCount, setResendCount] = useState<number>(0);
    const isRateLimited = resendCount >= SUPABASE_EMAIL_RATE_LIMIT;
    const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [expirySeconds, setExpirySeconds] = useState<number>(OTP_EXPIRY_SECONDS);
    const expiryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Timers ────────────────────────────────────────────────────────────────

    const startExpiryCountdown = useCallback((): void => {
        if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
        setExpirySeconds(OTP_EXPIRY_SECONDS);
        expiryIntervalRef.current = setInterval(() => {
            setExpirySeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(expiryIntervalRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const startResendCooldown = useCallback((): void => {
        if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        cooldownIntervalRef.current = setInterval(() => {
            setResendCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(cooldownIntervalRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => {
        startExpiryCountdown();
        return () => {
            if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
            if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
        };
    }, [startExpiryCountdown]);

    // ── Verify OTP ────────────────────────────────────────────────────────────

    const handleVerify = async (): Promise<void> => {
        if (otpCode.length !== OTP_LENGTH) {
            setHasError(true);
            setErrorMessage('Please enter the full 6-digit code.');
            return;
        }

        if (expirySeconds <= 0) {
            setHasError(true);
            setErrorMessage('Your code has expired. Please request a new one.');
            return;
        }

        setIsVerifying(true);
        setHasError(false);
        setErrorMessage('');

        const { data, error } = await authApi.verifyOTP(email ?? '', otpCode);
        setIsVerifying(false);

        if (error || !data.session) {
            setHasError(true);
            setErrorMessage('Invalid or expired code. Please check and try again.');
            setOtpCode('');
            return;
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('auth_id', data.session.user.id)
            .single();

        if (userData?.role === 'seller') {
            router.replace('/home/seller-dashboard' as Parameters<typeof router.replace>[0]);
        } else {
            router.replace('/(tabs)' as Parameters<typeof router.replace>[0]);
        }
    };

    // ── Resend OTP ────────────────────────────────────────────────────────────

    const handleResend = async (): Promise<void> => {
        if (isRateLimited || resendCooldown > 0) return;

        const { error } = await authApi.sendOTP(email ?? '');
        if (error) {
            Alert.alert('Resend Failed', 'Could not send a new code. Please try again shortly.');
            return;
        }

        setResendCount((prev) => prev + 1);
        setOtpCode('');
        setHasError(false);
        setErrorMessage('');
        startResendCooldown();
        startExpiryCountdown();
        Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    };

    const handleMagicLink = (): void => {
        Linking.openURL(MAGIC_LINK_URL);
    };

    return (
        <SafeScreen>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardAvoid}
            >
                <Animated.ScrollView
                    entering={Animation.Presets.FadeInDown}
                    exiting={Animation.Presets.FadeOutUp}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.content}>
                        <View style={[styles.iconContainer, { backgroundColor: `${theme.primary}14` }]}>
                            <Text style={styles.icon}>✉️</Text>
                        </View>
                        <Text style={[styles.title, { color: theme.textPrimary }]}>Verify Your Email</Text>
                        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                            We sent a 6-digit code to{'\n'}
                            <Text style={[styles.emailHighlight, { color: theme.textPrimary }]}>{email}</Text>
                        </Text>

                        <OTPInput
                            value={otpCode}
                            onChange={(code) => {
                                setOtpCode(code);
                                if (hasError) {
                                    setHasError(false);
                                    setErrorMessage('');
                                }
                            }}
                            hasError={hasError}
                        />

                        {hasError && errorMessage.length > 0 && (
                            <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
                        )}

                        <OTPExpiryTimer secondsRemaining={expirySeconds} />

                        {isVerifying ? (
                            <LoadingIndicator message="Verifying..." overlay={false} />
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.verifyButton,
                                    { backgroundColor: theme.primary },
                                    (otpCode.length !== OTP_LENGTH || expirySeconds <= 0) &&
                                    styles.verifyButtonDisabled,
                                ]}
                                onPress={handleVerify}
                                disabled={otpCode.length !== OTP_LENGTH || expirySeconds <= 0 || isVerifying}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.verifyButtonText, { color: theme.white }]}>Verify Code</Text>
                            </TouchableOpacity>
                        )}

                        <OTPResendButton
                            onResend={handleResend}
                            cooldownSeconds={resendCooldown}
                            isRateLimited={isRateLimited}
                            resendCount={resendCount}
                        />

                        <View style={styles.magicLinkContainer}>
                            <Text style={[styles.magicLinkText, { color: theme.textSecondary }]}>Having trouble? </Text>
                            <TouchableOpacity onPress={handleMagicLink} activeOpacity={0.7}>
                                <Text style={[styles.magicLinkAction, { color: theme.primary }]}>Send Magic Link Instead</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.spamTip, { color: theme.gray }]}>
                            💡 Tip: Check your spam or junk folder if you don't see it in your inbox.
                        </Text>
                    </View>
                </Animated.ScrollView>
            </KeyboardAvoidingView>
        </SafeScreen>
    );
}

// ─── Styles (layout & spacing only — NO color values) ─────────────────────────

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
    },
    keyboardAvoid: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    icon: {
        fontSize: 36,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 20,
    },
    emailHighlight: {
        fontWeight: '700',
    },
    errorText: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 10,
        fontWeight: '500',
    },
    verifyButton: {
        width: '100%',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
    },
    verifyButtonDisabled: {
        opacity: 0.5,
    },
    verifyButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    magicLinkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    magicLinkText: {
        fontSize: 13,
    },
    magicLinkAction: {
        fontSize: 13,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    spamTip: {
        fontSize: 12,
        textAlign: 'center',
        paddingHorizontal: 16,
        lineHeight: 18,
    },
});
