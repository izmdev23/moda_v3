import React, { useRef } from 'react';
import {
    Clipboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { OTP_LENGTH, SUPABASE_EMAIL_RATE_LIMIT } from '../utils/constants';
import { useTheme } from './ui/theme-provider';

// ─── OTPInput ─────────────────────────────────────────────────────────────────

interface OTPInputProps {
    readonly value: string;
    readonly onChange: (code: string) => void;
    readonly hasError: boolean;
}

/**
 * 6-digit OTP input that auto-focuses the next cell on each key entry,
 * auto-fills from clipboard paste, and visually highlights the active cell.
 * Colors are sourced from the active theme via useTheme().
 */
export const OTPInput: React.FC<OTPInputProps> = ({ value, onChange, hasError }) => {
    const { theme } = useTheme();
    const inputRefs = useRef<(TextInput | null)[]>([]);

    const digits: string[] = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

    const focusCell = (index: number): void => {
        const safeIndex = Math.max(0, Math.min(OTP_LENGTH - 1, index));
        inputRefs.current[safeIndex]?.focus();
    };

    const handleChange = (text: string, index: number): void => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length === 0) {
            const updated = digits.slice();
            updated[index] = '';
            onChange(updated.join(''));
            if (index > 0) focusCell(index - 1);
            return;
        }
        if (cleaned.length > 1) {
            const pasted = cleaned.slice(0, OTP_LENGTH);
            onChange(pasted.padEnd(OTP_LENGTH, '').slice(0, OTP_LENGTH));
            focusCell(Math.min(pasted.length, OTP_LENGTH - 1));
            return;
        }
        const updated = digits.slice();
        updated[index] = cleaned;
        onChange(updated.join(''));
        if (index < OTP_LENGTH - 1) focusCell(index + 1);
    };

    const handleKeyPress = (key: string, index: number): void => {
        if (key === 'Backspace' && digits[index] === '' && index > 0) {
            const updated = digits.slice();
            updated[index - 1] = '';
            onChange(updated.join(''));
            focusCell(index - 1);
        }
    };

    const handlePasteFromClipboard = async (): Promise<void> => {
        const text = await Clipboard.getString();
        if (!text) return;
        const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (cleaned.length > 0) {
            onChange(cleaned.padEnd(OTP_LENGTH, '').slice(0, OTP_LENGTH));
            focusCell(Math.min(cleaned.length, OTP_LENGTH - 1));
        }
    };

    return (
        <View style={otpStyles.container}>
            {digits.map((digit, i) => {
                const isFocused = value.length === i || (i === OTP_LENGTH - 1 && value.length >= OTP_LENGTH);
                const borderColor = hasError ? theme.error : isFocused || digit.length > 0 ? theme.primary : theme.border;
                const bgColor = hasError ? `${theme.error}10` : isFocused ? `${theme.primary}10` : theme.cardBackground;

                return (
                    <TextInput
                        key={i}
                        ref={(ref) => { inputRefs.current[i] = ref; }}
                        style={[
                            otpStyles.cell,
                            { borderColor, backgroundColor: bgColor, color: theme.textPrimary },
                        ]}
                        value={digit}
                        onChangeText={(text) => handleChange(text, i)}
                        onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, i)}
                        keyboardType="number-pad"
                        maxLength={OTP_LENGTH}
                        selectTextOnFocus
                        caretHidden
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                    />
                );
            })}
        </View>
    );
};

const otpStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 24,
    },
    cell: {
        width: 48,
        height: 56,
        borderRadius: 10,
        borderWidth: 1.5,
        textAlign: 'center',
        fontSize: 22,
        fontWeight: 'bold',
    },
});

// ─── OTPResendButton ──────────────────────────────────────────────────────────

interface OTPResendButtonProps {
    readonly onResend: () => void;
    readonly cooldownSeconds: number;
    readonly isRateLimited: boolean;
    readonly resendCount: number;
}

/**
 * Resend OTP button with a 60-second cooldown timer.
 * Warns the user if they are approaching the Supabase email rate limit.
 * Colors are sourced from the active theme via useTheme().
 */
export const OTPResendButton: React.FC<OTPResendButtonProps> = ({
    onResend,
    cooldownSeconds,
    isRateLimited,
    resendCount,
}) => {
    const { theme } = useTheme();
    const canResend = cooldownSeconds === 0 && !isRateLimited;

    return (
        <View style={resendStyles.container}>
            {isRateLimited ? (
                <View style={[resendStyles.rateLimitBox, { borderColor: theme.warning, backgroundColor: `${theme.warning}14` }]}>
                    <Text style={[resendStyles.rateLimitTitle, { color: theme.warning }]}>📧 Email limit reached</Text>
                    <Text style={[resendStyles.rateLimitMessage, { color: theme.textSecondary }]}>
                        Supabase allows only {SUPABASE_EMAIL_RATE_LIMIT} verification emails per
                        hour. Please wait before requesting another, or check your spam folder.
                    </Text>
                </View>
            ) : cooldownSeconds > 0 ? (
                <Text style={[resendStyles.cooldownText, { color: theme.textSecondary }]}>
                    Resend code in <Text style={[resendStyles.cooldownTimer, { color: theme.textPrimary }]}>{cooldownSeconds}s</Text>
                </Text>
            ) : (
                <TouchableOpacity onPress={onResend} disabled={!canResend} activeOpacity={0.7}>
                    <Text style={[resendStyles.resendText, { color: theme.primary }]}>Didn't receive a code? Resend</Text>
                </TouchableOpacity>
            )}

            {resendCount > 0 && resendCount < SUPABASE_EMAIL_RATE_LIMIT && (
                <Text style={[resendStyles.warningText, { color: theme.warning }]}>
                    ⚠️  {SUPABASE_EMAIL_RATE_LIMIT - resendCount} resend{resendCount === SUPABASE_EMAIL_RATE_LIMIT - 1 ? '' : 's'} remaining this hour
                </Text>
            )}
        </View>
    );
};

const resendStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginBottom: 24,
    },
    cooldownText: {
        fontSize: 14,
    },
    cooldownTimer: {
        fontWeight: 'bold',
    },
    resendText: {
        fontSize: 14,
        fontWeight: '600',
    },
    rateLimitBox: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 14,
        marginHorizontal: 8,
    },
    rateLimitTitle: {
        fontWeight: '700',
        marginBottom: 4,
        fontSize: 14,
    },
    rateLimitMessage: {
        fontSize: 13,
        lineHeight: 18,
    },
    warningText: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '500',
    },
});

// ─── OTPExpiryTimer ───────────────────────────────────────────────────────────

interface OTPExpiryTimerProps {
    readonly secondsRemaining: number;
}

/**
 * Countdown timer displaying how long until the current OTP expires (5 minutes).
 * Turns warning color in the final 60 seconds as a visual cue.
 * Colors are sourced from the active theme via useTheme().
 */
export const OTPExpiryTimer: React.FC<OTPExpiryTimerProps> = ({ secondsRemaining }) => {
    const { theme } = useTheme();
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    const isUrgent = secondsRemaining <= 60;

    if (secondsRemaining <= 0) {
        return (
            <Text style={[expiryStyles.text, { color: theme.error, fontWeight: '600' }]}>
                ⏱  Code expired. Please request a new one.
            </Text>
        );
    }

    return (
        <Text style={[expiryStyles.text, { color: isUrgent ? theme.warning : theme.textSecondary }]}>
            ⏱  Code expires in{' '}
            <Text style={expiryStyles.time}>
                {minutes}:{seconds.toString().padStart(2, '0')}
            </Text>
        </Text>
    );
};

const expiryStyles = StyleSheet.create({
    text: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 12,
    },
    time: {
        fontWeight: 'bold',
    },
});
