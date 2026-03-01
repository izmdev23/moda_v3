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
import { lightPalette } from '../utils/theme';

// ─── OTPInput ─────────────────────────────────────────────────────────────────

interface OTPInputProps {
    readonly value: string;
    readonly onChange: (code: string) => void;
    readonly hasError: boolean;
}

/**
 * 6-digit OTP input that auto-focuses the next cell on each key entry,
 * auto-fills from clipboard paste, and visually highlights the active cell.
 * Each digit cell is an individual TextInput for a premium UX.
 */
export const OTPInput: React.FC<OTPInputProps> = ({ value, onChange, hasError }) => {
    // Individual input refs for programmatic focus
    const inputRefs = useRef<(TextInput | null)[]>([]);

    // Pad/trim value to OTP_LENGTH
    const digits: string[] = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

    const focusCell = (index: number): void => {
        const safeIndex = Math.max(0, Math.min(OTP_LENGTH - 1, index));
        inputRefs.current[safeIndex]?.focus();
    };

    const handleChange = (text: string, index: number): void => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length === 0) {
            // Key deleted — clear this cell and focus previous
            const updated = digits.slice();
            updated[index] = '';
            onChange(updated.join(''));
            if (index > 0) focusCell(index - 1);
            return;
        }
        // Paste detection: >1 character entered at once
        if (cleaned.length > 1) {
            const pasted = cleaned.slice(0, OTP_LENGTH);
            onChange(pasted.padEnd(OTP_LENGTH, '').slice(0, OTP_LENGTH));
            focusCell(Math.min(pasted.length, OTP_LENGTH - 1));
            return;
        }
        // Single digit
        const updated = digits.slice();
        updated[index] = cleaned;
        onChange(updated.join(''));
        if (index < OTP_LENGTH - 1) focusCell(index + 1);
    };

    const handleKeyPress = (key: string, index: number): void => {
        if (key === 'Backspace' && digits[index] === '' && index > 0) {
            // Back-space on empty cell → jump to previous
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
                return (
                    <TextInput
                        key={i}
                        ref={(ref) => { inputRefs.current[i] = ref; }}
                        style={[
                            otpStyles.cell,
                            isFocused && otpStyles.cellFocused,
                            hasError && otpStyles.cellError,
                            digit.length > 0 && otpStyles.cellFilled,
                        ]}
                        value={digit}
                        onChangeText={(text) => handleChange(text, i)}
                        onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, i)}
                        keyboardType="number-pad"
                        maxLength={OTP_LENGTH} // Allow multi-char for paste
                        selectTextOnFocus
                        caretHidden
                        textContentType="oneTimeCode" // iOS SMS autofill
                        autoComplete="sms-otp" // Android autofill
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
        borderColor: '#E9ECEF',
        backgroundColor: '#FAFAFA',
        textAlign: 'center',
        fontSize: 22,
        fontWeight: 'bold',
        color: '#32325D',
    },
    cellFocused: {
        borderColor: lightPalette.primary,
        backgroundColor: '#FFF5F4',
    },
    cellFilled: {
        borderColor: lightPalette.primary,
    },
    cellError: {
        borderColor: lightPalette.error,
        backgroundColor: '#FFF5F5',
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
 * Warns the user if they are approaching the Supabase email rate limit (4/hour).
 */
export const OTPResendButton: React.FC<OTPResendButtonProps> = ({
    onResend,
    cooldownSeconds,
    isRateLimited,
    resendCount,
}) => {
    const canResend = cooldownSeconds === 0 && !isRateLimited;

    return (
        <View style={resendStyles.container}>
            {isRateLimited ? (
                <View style={resendStyles.rateLimitBox}>
                    <Text style={resendStyles.rateLimitTitle}>📧 Email limit reached</Text>
                    <Text style={resendStyles.rateLimitMessage}>
                        Supabase allows only {SUPABASE_EMAIL_RATE_LIMIT} verification emails per
                        hour. Please wait before requesting another, or check your spam folder.
                    </Text>
                </View>
            ) : cooldownSeconds > 0 ? (
                <Text style={resendStyles.cooldownText}>
                    Resend code in <Text style={resendStyles.cooldownTimer}>{cooldownSeconds}s</Text>
                </Text>
            ) : (
                <TouchableOpacity onPress={onResend} disabled={!canResend} activeOpacity={0.7}>
                    <Text style={resendStyles.resendText}>Didn't receive a code? Resend</Text>
                </TouchableOpacity>
            )}

            {resendCount > 0 && resendCount < SUPABASE_EMAIL_RATE_LIMIT && (
                <Text style={resendStyles.warningText}>
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
        color: '#525F7F',
    },
    cooldownTimer: {
        fontWeight: 'bold',
        color: '#32325D',
    },
    resendText: {
        fontSize: 14,
        color: lightPalette.primary,
        fontWeight: '600',
    },
    rateLimitBox: {
        backgroundColor: '#FFF9E6',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: lightPalette.warning,
        padding: 14,
        marginHorizontal: 8,
    },
    rateLimitTitle: {
        fontWeight: '700',
        color: '#7D4E00',
        marginBottom: 4,
        fontSize: 14,
    },
    rateLimitMessage: {
        fontSize: 13,
        color: '#7D4E00',
        lineHeight: 18,
    },
    warningText: {
        marginTop: 8,
        fontSize: 12,
        color: lightPalette.warning,
        fontWeight: '500',
    },
});

// ─── OTPExpiryTimer ───────────────────────────────────────────────────────────

interface OTPExpiryTimerProps {
    readonly secondsRemaining: number;
}

/**
 * Countdown timer displaying how long until the current OTP expires (5 minutes).
 * Turns red in the final 60 seconds as a visual warning.
 */
export const OTPExpiryTimer: React.FC<OTPExpiryTimerProps> = ({ secondsRemaining }) => {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    const isUrgent = secondsRemaining <= 60;

    if (secondsRemaining <= 0) {
        return (
            <Text style={[expiryStyles.text, expiryStyles.expired]}>
                ⏱  Code expired. Please request a new one.
            </Text>
        );
    }

    return (
        <Text style={[expiryStyles.text, isUrgent && expiryStyles.urgent]}>
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
        color: '#525F7F',
        textAlign: 'center',
        marginBottom: 12,
    },
    time: {
        fontWeight: 'bold',
    },
    urgent: {
        color: lightPalette.warning,
    },
    expired: {
        color: lightPalette.error,
        fontWeight: '600',
    },
});
