import React from 'react';
import { useForm } from 'react-hook-form';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FormInput } from './ui/form-input';
import { LoadingIndicator } from './ui/loading-indicator';

export interface SavedAccount {
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly token: string;
    readonly avatarUrl?: string; // Optional avatar
}

export interface SavedAccountCardProps {
    readonly account: SavedAccount;
    readonly onPress: (account: SavedAccount) => void;
    readonly onLongPress: (account: SavedAccount) => void;
}

/**
 * Displays a saved account card for quick login.
 * @param props {SavedAccountCardProps}
 */
export const SavedAccountCard: React.FC<SavedAccountCardProps> = ({ account, onPress, onLongPress }) => {
    return (
        <TouchableOpacity
            style={styles.cardContainer}
            onPress={() => onPress(account)}
            onLongPress={() => onLongPress(account)}
            activeOpacity={0.7}
        >
            <View style={styles.avatarContainer}>
                {account.avatarUrl ? (
                    <Image source={{ uri: account.avatarUrl }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarFallback}>
                        <Text style={styles.avatarFallbackText}>
                            {account.firstName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>
            <View style={styles.infoContainer}>
                <Text style={styles.nameText}>{`${account.firstName} ${account.lastName}`}</Text>
                <Text style={styles.emailText}>{account.email}</Text>
            </View>
        </TouchableOpacity>
    );
};

export interface LoginFormProps {
    readonly onSubmit: (data: any) => void;
    readonly isLoading: boolean;
}

/**
 * Login form with email and password fields.
 * @param props {LoginFormProps}
 */
export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading }) => {
    const { control, handleSubmit, formState: { errors } } = useForm({
        defaultValues: { email: '', password: '' }
    });

    return (
        <View style={styles.formContainer}>
            <FormInput
                name="email"
                control={control}
                label="Email"
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                rules={{
                    required: 'Email is required',
                    pattern: {
                        value: /\S+@\S+\.\S+/,
                        message: 'Enter a valid email'
                    }
                }}
                error={errors.email?.message as string}
            />
            <FormInput
                name="password"
                control={control}
                label="Password"
                placeholder="Enter your password"
                secureTextEntry
                rules={{ required: 'Password is required' }}
                error={errors.password?.message as string}
            />

            <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSubmit(onSubmit)}
                disabled={isLoading}
            >
                {isLoading ? (
                    <LoadingIndicator message="Logging in..." overlay={false} />
                ) : (
                    <Text style={styles.buttonText}>Log In</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

export interface BiometricPromptProps {
    readonly onPress: () => void;
    readonly isSupported: boolean;
}

/**
 * Biometric prompt option for logging in.
 * @param props {BiometricPromptProps}
 */
export const BiometricPrompt: React.FC<BiometricPromptProps> = ({ onPress, isSupported }) => {
    if (!isSupported) return null;

    return (
        <TouchableOpacity style={styles.biometricButton} onPress={onPress}>
            <Text style={styles.biometricButtonText}>Login with Biometrics</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E9ECEF',
        marginBottom: 12,
    },
    avatarContainer: {
        marginRight: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F44336', // Primary color
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarFallbackText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    infoContainer: {
        flex: 1,
    },
    nameText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#32325D',
        marginBottom: 4,
    },
    emailText: {
        fontSize: 14,
        color: '#525F7F',
    },
    formContainer: {
        width: '100%',
    },
    button: {
        backgroundColor: '#F44336', // Primary theme color
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    biometricButton: {
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 12,
    },
    biometricButtonText: {
        color: '#F44336',
        fontSize: 16,
        fontWeight: '600',
    }
});
