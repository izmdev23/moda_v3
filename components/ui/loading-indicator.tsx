import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme-provider';

export interface LoadingIndicatorProps {
    readonly overlay?: boolean;
    readonly message?: string;
    readonly color?: string;
}

/**
 * Shared Loading Indicator component.
 * Uses the active theme's primary color by default.
 * @param props {LoadingIndicatorProps}
 * @example
 * <LoadingIndicator overlay={true} message="Uploading..." />
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
    overlay = false,
    message,
    color,
}) => {
    const { theme } = useTheme();
    const indicatorColor = color ?? theme.primary;

    if (overlay) {
        return (
            <View style={styles.overlayContainer}>
                <View style={[styles.contentBox, { backgroundColor: theme.cardBackground }]}>
                    <ActivityIndicator size="small" color={indicatorColor} />
                    {message && <Text style={[styles.overlayMessage, { color: theme.textPrimary }]}>{message}</Text>}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ActivityIndicator size="small" color={indicatorColor} />
            {message && <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    message: {
        marginTop: 8,
        fontSize: 14,
        textAlign: 'center'
    },
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999
    },
    contentBox: {
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        minWidth: 120
    },
    overlayMessage: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center'
    }
});
