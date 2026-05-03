import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RipplePressable } from '@/components/ui/ripple-pressable';
import { useTheme } from './theme-provider';

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
 * Empty state component for FlatLists.
 * Colors are derived from the active theme via useTheme().
 * @param props {EmptyListProps}
 */
export const EmptyList: React.FC<EmptyListProps> = ({
    icon,
    message,
    submessage,
    actionButton
}) => {
    const { theme } = useTheme();

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>{icon}</View>
            <Text style={[styles.message, { color: theme.textPrimary }]}>{message}</Text>
            {submessage && <Text style={[styles.submessage, { color: theme.textSecondary }]}>{submessage}</Text>}
            {actionButton && (
                <RipplePressable
                    style={[styles.button, { backgroundColor: theme.primary }]}
                    onPress={actionButton.onPress}
                >
                    <Text style={[styles.buttonText, { color: theme.white }]}>{actionButton.label}</Text>
                </RipplePressable>
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
        textAlign: 'center',
        marginBottom: 8
    },
    submessage: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8
    },
    buttonText: {
        fontWeight: '600',
        fontSize: 16
    }
});
