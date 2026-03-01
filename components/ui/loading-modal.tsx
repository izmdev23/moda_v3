import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Animation } from '../../utils/animation';
import { lightPalette } from '../../utils/theme';

interface LoadingModalProps {
    /** Whether the modal is visible */
    readonly isVisible: boolean;
    /** Optional message to display below the indicator */
    readonly message?: string;
}

/**
 * A unified generic activity indicator modal for asynchronous operations.
 * Uses React Native Reanimated for entering and exiting animations.
 * 
 * @param {LoadingModalProps} props - The component props.
 * @returns {React.JSX.Element | null} The rendered component.
 */
export const LoadingModal: React.FC<LoadingModalProps> = ({ isVisible, message }): React.JSX.Element | null => {
    if (!isVisible) return null;

    return (
        <Modal
            transparent
            visible={isVisible}
            animationType="none"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Animated.View
                    entering={Animation.Presets.FadeIn}
                    exiting={Animation.Presets.FadeOut}
                    style={styles.container}
                >
                    <ActivityIndicator size="small" color={lightPalette.primary} />
                    {message && (
                        <Text style={styles.message}>{message}</Text>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 140,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    message: {
        marginTop: 12,
        fontSize: 14,
        color: '#32325D',
        fontWeight: '600',
        textAlign: 'center',
    },
});
