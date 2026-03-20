import * as LocalAuthentication from 'expo-local-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { FormInput } from '../../components/ui/form-input';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { Animation } from '../../utils/animation';
import { authApi } from '../../utils/database/auth';
import { usersTable } from '../../utils/database/users-table';
import { getSecureItem, setSecureItem } from '../../utils/secureStorage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SAVED_ACCOUNTS_KEY = 'SAVED_LOGIN_ACCOUNTS';
const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1_000; // 1 minute

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SavedAccount {
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly token: string;
    readonly avatarUrl?: string;
}

interface LoginFormData {
    readonly email: string;
    readonly password: string;
}

interface ConfirmDialogState {
    readonly visible: boolean;
    readonly title: string;
    readonly message: string;
    readonly onConfirm: () => void;
    readonly variant?: 'danger' | 'info' | 'warning';
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
/**
 * LoginScreen — entry point for user authentication.
 * Supports email/password login, saved-account quick-login, and biometrics.
 * Colors are sourced from the active theme via useTheme().
 */
export default function LoginScreen(): React.JSX.Element {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { theme } = useTheme();

    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
    const [showLoginForm, setShowLoginForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [biometricSupported, setBiometricSupported] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [cooldownTime, setCooldownTime] = useState(0);
    const [currentAuthId, setCurrentAuthId] = useState<string | null>(null);

    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
        visible: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        defaultValues: { email: '', password: '' },
    });

    // -- Effects ---------------------------------------------------------------
    useEffect(() => {
        void loadSavedAccounts();
        void checkBiometrics();

        if (params.error) {
            Alert.alert(
                'Authentication Error',
                (params.error_description as string)?.replace(/\+/g, ' ') || 'An error occurred during verification.',
            );
        } else if (params.message) {
            Alert.alert('Success', (params.message as string)?.replace(/\+/g, ' '));
        }
    }, [params]);

    useEffect(() => {
        if (cooldownTime <= Date.now()) return;
        const interval = setInterval(() => {
            if (Date.now() >= cooldownTime) {
                setCooldownTime(0);
                setFailedAttempts(0);
            }
        }, 1_000);
        return () => clearInterval(interval);
    }, [cooldownTime]);

    // -- Helpers ---------------------------------------------------------------
    const loadSavedAccounts = async (): Promise<void> => {
        const stored = await getSecureItem(SAVED_ACCOUNTS_KEY);
        if (!stored) { setShowLoginForm(true); return; }
        try {
            const parsed = JSON.parse(stored) as SavedAccount[];
            setSavedAccounts(parsed);
            if (parsed.length === 0) setShowLoginForm(true);
        } catch {
            setShowLoginForm(true);
        }
    };

    const saveAccountsToStore = async (accounts: SavedAccount[]): Promise<void> => {
        await setSecureItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
        setSavedAccounts(accounts);
    };

    const checkBiometrics = async (): Promise<void> => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricSupported(hasHardware && isEnrolled);
    };

    const navigateByRole = async (authId: string): Promise<void> => {
        const { data: user } = await usersTable.getByAuthId(authId);
        if (user?.role === 'seller') {
            router.replace('/home/seller-dashboard');
        } else {
            router.replace('/(tabs)');
        }
    };

    const finalizeLogin = async (session: { user: { id: string; email?: string }; refresh_token?: string }): Promise<void> => {
        setIsLoading(false);
        const email = session.user.email ?? '';
        const existing = savedAccounts.find(a => a.email === email);
        setCurrentAuthId(session.user.id);

        if (!existing && session.refresh_token) {
            setConfirmDialog({
                visible: true,
                title: 'Save Login Info',
                message: 'Do you want to save your login info for faster access next time?',
                onConfirm: async () => {
                    const { data: dbUser } = await usersTable.getByAuthId(session.user.id);
                    const newAccount: SavedAccount = {
                        email,
                        firstName: dbUser?.first_name ?? 'User',
                        lastName: dbUser?.last_name ?? '',
                        token: session.refresh_token ?? '',
                        avatarUrl: dbUser?.avatar_url ?? undefined,
                    };
                    await saveAccountsToStore([...savedAccounts, newAccount]);
                    setConfirmDialog(p => ({ ...p, visible: false }));
                    await navigateByRole(session.user.id);
                },
            });
        } else {
            await navigateByRole(session.user.id);
        }
    };

    // -- Event Handlers --------------------------------------------------------
    const onSubmitEmail = async (data: LoginFormData): Promise<void> => {
        if (cooldownTime > Date.now()) {
            Alert.alert('Rate Limited', 'Please wait before trying again.');
            return;
        }
        setIsLoading(true);
        const { data: authData, error } = await authApi.signIn(data.email, data.password);

        if (error || !authData.session) {
            setIsLoading(false);
            const newFailed = failedAttempts + 1;
            setFailedAttempts(newFailed);
            if (newFailed >= MAX_FAILED_ATTEMPTS) {
                setCooldownTime(Date.now() + COOLDOWN_MS);
                Alert.alert('Too many failed attempts', 'Please wait 1 minute before trying again.');
            } else {
                Alert.alert('Login Failed', 'Invalid email or password.');
            }
            return;
        }
        await finalizeLogin(authData.session);
    };

    const handleAutoLogin = async (account: SavedAccount): Promise<void> => {
        setIsLoading(true);
        const { data, error } = await authApi.refreshSession(account.token);
        setIsLoading(false);
        if (error || !data.session) {
            Alert.alert('Session Expired', 'Please login with your email and password again.');
            setShowLoginForm(true);
        } else {
            await navigateByRole(data.session.user.id);
        }
    };

    const handleBiometricLogin = async (): Promise<void> => {
        if (savedAccounts.length === 0) return;
        setIsLoading(true);
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Login with Biometrics',
            fallbackLabel: 'Use Passcode',
        });
        if (result.success) {
            await handleAutoLogin(savedAccounts[0]);
        } else {
            setIsLoading(false);
        }
    };

    const handleRemoveAccount = (account: SavedAccount): void => {
        setConfirmDialog({
            visible: true,
            title: 'Remove Saved Account',
            message: `Are you sure you want to remove ${account.email}?`,
            variant: 'danger',
            onConfirm: async () => {
                const updated = savedAccounts.filter(a => a.email !== account.email);
                await saveAccountsToStore(updated);
                setConfirmDialog(p => ({ ...p, visible: false }));
                if (updated.length === 0) setShowLoginForm(true);
            },
        });
    };

    const isCooldown = cooldownTime > Date.now();
    const cooldownSeconds = Math.ceil((cooldownTime - Date.now()) / 1_000);

    // -- Render ----------------------------------------------------------------
    return (
        <SafeScreen>
            <Animated.View
                entering={Animation.Presets.FadeInDown}
                exiting={Animation.Presets.FadeOutUp}
                style={styles.container}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardAvoid}
                >
                    <Text style={[styles.header, { color: theme.textPrimary }]}>Welcome Back</Text>

                    {/* ------- Saved Accounts ------- */}
                    {!showLoginForm && savedAccounts.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.subtext, { color: theme.textSecondary }]}>Log in as:</Text>
                            <FlatList
                                data={savedAccounts}
                                keyExtractor={(item) => item.email}
                                scrollEnabled={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.accountCard, {
                                            backgroundColor: theme.cardBackground,
                                            borderColor: theme.border,
                                        }]}
                                        onPress={() => void handleAutoLogin(item)}
                                        onLongPress={() => handleRemoveAccount(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.avatarWrap}>
                                            {item.avatarUrl ? (
                                                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                                            ) : (
                                                <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
                                                    <Text style={[styles.avatarFallbackText, { color: theme.white }]}>
                                                        {item.firstName.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.accountInfo}>
                                            <Text style={[styles.accountName, { color: theme.textPrimary }]}>{`${item.firstName} ${item.lastName}`}</Text>
                                            <Text style={[styles.accountEmail, { color: theme.textSecondary }]}>{item.email}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />

                            {biometricSupported && (
                                <TouchableOpacity style={styles.biometricBtn} onPress={() => void handleBiometricLogin()}>
                                    <Text style={[styles.biometricBtnText, { color: theme.primary }]}>Login with Biometrics</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={styles.switchBtn} onPress={() => setShowLoginForm(true)}>
                                <Text style={[styles.switchBtnText, { color: theme.info }]}>Login to another account</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ------- Email / Password Form ------- */}
                    {showLoginForm && (
                        <View style={styles.section}>
                            <FormInput
                                name="email"
                                control={control}
                                label="Email"
                                placeholder="Enter your email"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                rules={{
                                    required: 'Email is required',
                                    pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
                                }}
                                error={errors.email?.message}
                            />
                            <FormInput
                                name="password"
                                control={control}
                                label="Password"
                                placeholder="Enter your password"
                                secureTextEntry
                                rules={{ required: 'Password is required' }}
                                error={errors.password?.message}
                            />

                            <TouchableOpacity
                                style={[styles.loginBtn, { backgroundColor: theme.primary }, isLoading && styles.loginBtnDisabled]}
                                onPress={() => void handleSubmit(onSubmitEmail)()}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <LoadingIndicator message="Logging in..." overlay={false} />
                                ) : (
                                    <Text style={[styles.loginBtnText, { color: theme.white }]}>Log In</Text>
                                )}
                            </TouchableOpacity>

                            {isCooldown && (
                                <Text style={[styles.cooldownText, { color: theme.error }]}>
                                    Too many failed attempts. Try again in {cooldownSeconds}s
                                </Text>
                            )}

                            {savedAccounts.length > 0 && (
                                <TouchableOpacity style={styles.switchBtn} onPress={() => setShowLoginForm(false)}>
                                    <Text style={[styles.switchBtnText, { color: theme.info }]}>Cancel</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* ------- Sign Up Link ------- */}
                    <View style={styles.signupRow}>
                        <Text style={[styles.signupText, { color: theme.textSecondary }]}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/auth/signup' as never)}>
                            <Text style={[styles.signupLink, { color: theme.primary }]}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>

                <ConfirmDialog
                    visible={confirmDialog.visible}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    variant={confirmDialog.variant}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => {
                        setConfirmDialog(p => ({ ...p, visible: false }));
                        if (confirmDialog.title === 'Save Login Info') {
                            if (currentAuthId) {
                                void navigateByRole(currentAuthId);
                            } else {
                                router.replace('/(tabs)');
                            }
                        }
                    }}
                />
            </Animated.View>
        </SafeScreen>
    );
}

// ---------------------------------------------------------------------------
// Styles (layout & spacing only — NO color values)
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
    container: { flex: 1 },
    keyboardAvoid: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 24,
        textAlign: 'center',
    },
    section: { width: '100%' },
    subtext: { fontSize: 16, marginBottom: 16 },

    // Saved account card
    accountCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    avatarWrap: { marginRight: 16 },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarFallbackText: { fontSize: 20, fontWeight: 'bold' },
    accountInfo: { flex: 1 },
    accountName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    accountEmail: { fontSize: 14 },

    // Buttons
    loginBtn: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    loginBtnDisabled: { opacity: 0.7 },
    loginBtnText: { fontSize: 16, fontWeight: 'bold' },
    biometricBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 12 },
    biometricBtnText: { fontSize: 16, fontWeight: '600' },
    switchBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 16 },
    switchBtnText: { fontSize: 14, fontWeight: '600' },

    // Misc
    cooldownText: { textAlign: 'center', marginTop: 12, fontSize: 14 },
    signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
    signupText: { fontSize: 14 },
    signupLink: { fontSize: 14, fontWeight: 'bold' },
});