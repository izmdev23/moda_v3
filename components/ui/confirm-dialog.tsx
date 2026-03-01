import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <View style={styles.dialog}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>
                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                            <Text style={styles.cancelText}>{cancelLabel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.confirmButton,
                                variant === 'danger' && styles.dangerButton,
                                variant === 'warning' && styles.warningButton
                            ]}
                            onPress={onConfirm}
                        >
                            <Text style={styles.confirmText}>{confirmLabel}</Text>
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
        backgroundColor: '#fff', // Ideally use theme, but keeping it simple
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
        color: '#1A1A1A'
    },
    message: {
        fontSize: 16,
        color: '#666',
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
        backgroundColor: '#F5F5F5'
    },
    cancelText: {
        color: '#666',
        fontWeight: '600'
    },
    confirmButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#007AFF'
    },
    dangerButton: {
        backgroundColor: '#FF3B30'
    },
    warningButton: {
        backgroundColor: '#FF9500'
    },
    confirmText: {
        color: '#FFFFFF',
        fontWeight: '600'
    }
});
