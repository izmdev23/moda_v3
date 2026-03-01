import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface EmptyListProps {
    readonly icon: React.ReactNode;
    readonly message: string;
    readonly submessage?: string;
    readonly actionButton?: {
        readonly label: string;
        readonly onPress: () => void;
    };
}

/**
 * Empty state component for FlatLists
 * @param props {EmptyListProps}
 */
export const EmptyList: React.FC<EmptyListProps> = ({
    icon,
    message,
    submessage,
    actionButton
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>{icon}</View>
            <Text style={styles.message}>{message}</Text>
            {submessage && <Text style={styles.submessage}>{submessage}</Text>}
            {actionButton && (
                <TouchableOpacity style={styles.button} onPress={actionButton.onPress}>
                    <Text style={styles.buttonText}>{actionButton.label}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 300
    },
    iconContainer: {
        marginBottom: 16
    },
    message: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 8
    },
    submessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#007AFF', // Theme primary
        borderRadius: 8
    },
    buttonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16
    }
});
