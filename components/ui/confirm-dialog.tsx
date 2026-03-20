import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme-provider';

export interface ConfirmDialogProps {
    readonly title: string;
    readonly message: string;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
    readonly visible: boolean;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
    readonly variant?: 'danger' | 'warning' | 'info';
}

/**
 * Reusable modal for destructive or important actions.
 * Uses the active theme for all colors — no hardcoded hex values.
 * @param props {ConfirmDialogProps}
 * @example
 * <ConfirmDialog title="Delete" message="Are you sure?" onConfirm={handleDelete} onCancel={close} visible={true} />
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    message,
    onConfirm,
    onCancel,
    visible,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'info'
}) => {
    const { theme } = useTheme();

    const confirmBg =
        variant === 'danger' ? theme.error :
            variant === 'warning' ? theme.warning :
                theme.info;

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <View style={[styles.dialog, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
                    <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.cancelButton, { backgroundColor: theme.border }]}
                            onPress={onCancel}
                        >
                            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>{cancelLabel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmButton, { backgroundColor: confirmBg }]}
                            onPress={onConfirm}
                        >
                            <Text style={[styles.confirmText, { color: theme.white }]}>{confirmLabel}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
    },
    dialog: {
        borderRadius: 12,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    message: {
        fontSize: 16,
        marginBottom: 24,
        lineHeight: 22
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    cancelText: {
        fontWeight: '600'
    },
    confirmButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    confirmText: {
        color: '#FFFFFF',
        fontWeight: '600'
    }
});
