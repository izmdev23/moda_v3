import { RipplePressable } from '@/components/ui/ripple-pressable';
import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme-provider';

interface ModaAlertModalProps {
    readonly visible: boolean;
    readonly title: string;
    readonly message: string;
    readonly positiveLabel?: string;
    readonly negativeLabel?: string;
    readonly onPositivePress: () => void;
    readonly onNegativePress?: () => void;
    readonly onRequestClose?: () => void;
}

/**
 * Themed alert modal for Moda flows.
 * Uses primary color for the positive action and gray for the negative action.
 */
export const ModaAlertModal: React.FC<ModaAlertModalProps> = ({
    visible,
    title,
    message,
    positiveLabel = 'OK',
    negativeLabel,
    onPositivePress,
    onNegativePress,
    onRequestClose,
}) => {
    const { theme } = useTheme();
    const handleRequestClose = onRequestClose ?? onPositivePress;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleRequestClose}>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
                    <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

                    <View style={styles.actionsRow}>
                        {negativeLabel !== undefined && typeof onNegativePress === 'function' && (
                            <RipplePressable
                                style={[styles.button, styles.negativeButton, { backgroundColor: theme.gray }]}
                                onPress={onNegativePress}
                            >
                                <Text style={[styles.buttonText, { color: theme.white }]}>{negativeLabel}</Text>
                            </RipplePressable>
                        )}

                        <RipplePressable
                            style={[styles.button, styles.positiveButton, { backgroundColor: theme.primary }]}
                            onPress={onPositivePress}
                        >
                            <Text style={[styles.buttonText, { color: theme.white }]}>{positiveLabel}</Text>
                        </RipplePressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 16,
    },
    button: {
        borderRadius: 10,
        minWidth: 86,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    positiveButton: {},
    negativeButton: {},
    buttonText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
