import React, { useState } from 'react';
import { Control, Controller, RegisterOptions } from 'react-hook-form';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';

export interface FormInputProps extends Omit<TextInputProps, 'name'> {
    readonly name: string;
    readonly control: Control<any>;
    readonly rules?: RegisterOptions;
    readonly label: string;
    readonly error?: string;
    readonly placeholder?: string;
    readonly secureTextEntry?: boolean;
    readonly multiline?: boolean;
}

/**
 * Reusable Form Input integrated with react-hook-form Controller
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
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isPasswordField = secureTextEntry;
    const currentSecureTextEntry = isPasswordField && !isPasswordVisible;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.inputContainer, error ? styles.inputContainerError : null]}>
                <Controller
                    control={control}
                    name={name}
                    rules={rules}
                    render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                            style={[styles.input, multiline && styles.inputMultiline]}
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            placeholder={placeholder}
                            placeholderTextColor="#A0A0A0"
                            secureTextEntry={currentSecureTextEntry}
                            multiline={multiline}
                            {...rest}
                        />
                    )}
                />
                {isPasswordField && (
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setIsPasswordVisible(prev => !prev)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.eyeText}>
                            {isPasswordVisible ? 'Hide' : 'Show'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
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
        color: '#333',
        marginBottom: 6,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        backgroundColor: '#FAFAFA',
    },
    inputContainerError: {
        borderColor: '#FF3B30',
        backgroundColor: '#FFF5F5',
    },
    input: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#333',
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
        color: '#007AFF', // Theme primary
        fontWeight: '500',
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 12,
        marginTop: 4,
    },
});
