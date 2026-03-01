import * as LocalAuthentication from 'expo-local-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BiometricPrompt, LoginForm, SavedAccount, SavedAccountCard } from '../../components/login-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { SafeScreen } from '../../components/ui/safe-screen';
import { authApi } from '../../utils/database/auth';
import { usersTable } from '../../utils/database/users-table';
import { getSecureItem, setSecureItem } from '../../utils/secureStorage';

import Animated from 'react-native-reanimated';
import { Animation } from '../../utils/animation';

const SAVED_ACCOUNTS_KEY = 'SAVED_LOGIN_ACCOUNTS';
const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1000; // 1 minute

export default function LoginScreen(): React.JSX.Element {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
    const [showLoginForm, setShowLoginForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [biometricSupported, setBiometricSupported] = useState(false);

    const [failedAttempts, setFailedAttempts] = useState(0);
    const [cooldownTime, setCooldownTime] = useState(0);

    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'info' | 'warning';
    }>({
        visible: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    useEffect(() => {
        loadSavedAccounts();
        checkBiometrics();

        // Handle redirect outcomes (e.g., from email confirmation)
        if (params.error) {
            Alert.alert(
                'Authentication Error',
                (params.error_description as string)?.replace(/\+/g, ' ') || 'An error occurred during verification.'
            );
        } else if (params.message) {
            Alert.alert(
                'Success',
                (params.message as string)?.replace(/\+/g, ' ')
            );
        } else if (params.auth_callback) {
            // Placeholder for custom callback handling if needed
        }
    }, [params]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (cooldownTime > Date.now()) {
            interval = setInterval(() => {
                if (Date.now() >= cooldownTime) {
                    setCooldownTime(0);
                    setFailedAttempts(0);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [cooldownTime]);

    const loadSavedAccounts = async (): Promise<void> => {
        const stored = await getSecureItem(SAVED_ACCOUNTS_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setSavedAccounts(parsed);
                if (parsed.length === 0) {
                    setShowLoginForm(true);
                }
            } catch (e) {
                setShowLoginForm(true);
            }
        } else {
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

    const handleLoginWithEmail = async (data: any): Promise<void> => {
        if (cooldownTime > Date.now()) {
            Alert.alert('Rate Limited', `Please wait before trying again.`);
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

        await finalizeLogin(authData.session, data.password); // pass password or just ask to save?
    };

    const handleAutoLogin = async (account: SavedAccount): Promise<void> => {
        setIsLoading(true);
        const { data, error } = await authApi.refreshSession(account.token);
        setIsLoading(false);

        if (error || !data.session) {
            Alert.alert('Session Expired', 'Please login with your email and password again.');
            setShowLoginForm(true);
        } else {
            // Success
            router.replace('/(tabs)');
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
            // Just auto-login with the first saved account for simplicity
            await handleAutoLogin(savedAccounts[0]);
        } else {
            setIsLoading(false);
        }
    };

    const finalizeLogin = async (session: any, password?: string): Promise<void> => {
        setIsLoading(false);
        const email = session.user.email;
        const existing = savedAccounts.find(a => a.email === email);

        if (!existing && session.refresh_token) {
            // Prompt to save
            setConfirmDialog({
                visible: true,
                title: 'Save Login Info',
                message: 'Do you want to save your login info for faster access next time?',
                onConfirm: async () => {
                    const authId = session.user.id;
                    const { data: dbUser } = await usersTable.getByAuthId(authId);
                    const newAccount: SavedAccount = {
                        email: email,
                        firstName: dbUser?.first_name || 'User',
                        lastName: dbUser?.last_name || '',
                        token: session.refresh_token,
                        avatarUrl: dbUser?.avatar_url || undefined,
                    };
                    await saveAccountsToStore([...savedAccounts, newAccount]);
                    setConfirmDialog(p => ({ ...p, visible: false }));
                    router.replace('/(tabs)');
                }
            });
        } else {
            router.replace('/(tabs)');
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
            }
        });
    };

    const isCooldown = cooldownTime > Date.now();
    const cooldownSeconds = Math.ceil((cooldownTime - Date.now()) / 1000);

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
                    <Text style={styles.header}>Welcome Back</Text>


                    {!showLoginForm && savedAccounts.length > 0 && (
                        <View style={styles.savedAccountsContainer}>
                            <Text style={styles.subtext}>Log in as:</Text>
                            <FlatList
                                data={savedAccounts}
                                keyExtractor={(item) => item.email}
                                renderItem={({ item }) => (
                                    <SavedAccountCard
                                        account={item}
                                        onPress={handleAutoLogin}
                                        onLongPress={handleRemoveAccount}
                                    />
                                )}
                                scrollEnabled={false}
                            />

                            {biometricSupported && (
                                <BiometricPrompt isSupported={biometricSupported} onPress={handleBiometricLogin} />
                            )}

                            <TouchableOpacity
                                style={styles.switchButton}
                                onPress={() => setShowLoginForm(true)}
                            >
                                <Text style={styles.switchButtonText}>Login to another account</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showLoginForm && (
                        <View style={styles.formContainer}>
                            <LoginForm
                                onSubmit={handleLoginWithEmail}
                                isLoading={isLoading}
                            />

                            {isCooldown && (
                                <Text style={styles.cooldownText}>
                                    Too many failed attempts. Try again in {cooldownSeconds}s
                                </Text>
                            )}

                            {savedAccounts.length > 0 && (
                                <TouchableOpacity style={styles.switchButton} onPress={() => setShowLoginForm(false)}>
                                    <Text style={styles.switchButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <View style={styles.signupContainer}>
                        <Text style={styles.signupText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/auth/signup' as any)}>
                            <Text style={styles.signupLink}>Sign Up</Text>
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
                            router.replace('/(tabs)');
                        }
                    }}
                />
            </Animated.View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardAvoid: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },

    header: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#32325D',
        marginBottom: 24,
        textAlign: 'center',
    },
    savedAccountsContainer: {
        width: '100%',
    },
    subtext: {
        fontSize: 16,
        color: '#525F7F',
        marginBottom: 16,
    },
    formContainer: {
        width: '100%',
    },
    switchButton: {
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    switchButtonText: {
        color: '#007AFF', // Usually info color, change as needed
        fontSize: 14,
        fontWeight: '600',
    },
    cooldownText: {
        color: '#F5365C',
        textAlign: 'center',
        marginTop: 12,
        fontSize: 14,
    },
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
    },
    signupText: {
        color: '#525F7F',
        fontSize: 14,
    },
    signupLink: {
        color: '#F44336',
        fontSize: 14,
        fontWeight: 'bold',
    },
});