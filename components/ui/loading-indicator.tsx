import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { lightPalette } from '../../utils/theme';

export interface LoadingIndicatorProps {
    readonly overlay?: boolean;
    readonly message?: string;
    readonly color?: string;
}

/**
 * Shared Loading Indicator component
 * @param props {LoadingIndicatorProps}
 * @example
 * <LoadingIndicator overlay={true} message="Uploading..." />
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
    overlay = false,
    message,
    color = lightPalette.primary // Theme primary color
}) => {
    if (overlay) {
        return (
            <View style={styles.overlayContainer}>
                <View style={styles.contentBox}>
                    <ActivityIndicator size="small" color={color} />
                    {message && <Text style={styles.overlayMessage}>{message}</Text>}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ActivityIndicator size="small" color={color} />
            {message && <Text style={styles.message}>{message}</Text>}
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
        color: '#666',
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
        backgroundColor: '#FFF',
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
        color: '#333',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center'
    }
});
