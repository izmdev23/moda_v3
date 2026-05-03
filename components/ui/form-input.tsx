import { RipplePressable } from '@/components/ui/ripple-pressable';
import React, { useState } from 'react';
import { Control, Controller, RegisterOptions } from 'react-hook-form';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from './theme-provider';

export interface FormInputProps extends Omit<TextInputProps, 'name'> {
    readonly name: string;
    readonly control: Control<Record<string, unknown>>;
    readonly rules?: RegisterOptions<Record<string, unknown>>;
    readonly label: string;
    readonly error?: string;
    readonly placeholder?: string;
    readonly secureTextEntry?: boolean;
    readonly multiline?: boolean;
}

/**
 * Reusable Form Input integrated with react-hook-form Controller.
 * Colors are sourced from the active theme via useTheme().
 * @param props {FormInputProps}
 */
export const FormInput: React.FC<FormInputProps> = ({
    name,
    control,
    rules,
    label,
    error,
    placeholder,
    secureTextEntry,
    multiline,
    ...rest
}) => {
    const { theme } = useTheme();
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isPasswordField = secureTextEntry;
    const currentSecureTextEntry = isPasswordField && !isPasswordVisible;

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
            <View style={[
                styles.inputContainer,
                { borderColor: error ? theme.error : theme.border, backgroundColor: theme.cardBackground },
                error ? { backgroundColor: `${theme.error}10` } : null,
            ]}>
                <Controller
                    control={control}
                    name={name}
                    rules={rules}
                    render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                            style={[styles.input, multiline && styles.inputMultiline, { color: theme.textPrimary }]}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            placeholder={placeholder}
                            placeholderTextColor={theme.gray}
                            secureTextEntry={currentSecureTextEntry}
                            multiline={multiline}
                            {...rest}
                        />
                    )}
                />
                {isPasswordField && (
                    <RipplePressable
                        style={styles.eyeIcon}
                        onPress={() => setIsPasswordVisible(prev => !prev)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.eyeText, { color: theme.primary }]}>
                            {isPasswordVisible ? 'Hide' : 'Show'}
                        </Text>
                    </RipplePressable>
                )}
            </View>
            {error && <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
    },
    input: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    },
    inputMultiline: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    eyeIcon: {
        padding: 12,
    },
    eyeText: {
        fontSize: 14,
        fontWeight: '500',
    },
    errorText: {
        fontSize: 12,
        marginTop: 4,
    },
});
