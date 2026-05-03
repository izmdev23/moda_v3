import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { RipplePressable } from '@/components/ui/ripple-pressable';
import { useTheme } from './theme-provider';

export interface Address {
    uid: string;
    label: string;
    fullAddress: string;
    phone: string;
}

export interface AddressDropdownProps {
    readonly addresses: Address[];
    readonly selectedUid: string | null;
    readonly onSelect: (uid: string) => void;
    readonly onAddAddress: () => void;
}

/**
 * AddressDropdown — allows the user to switch the selected delivery address.
 * Colors are sourced from the active theme via useTheme().
 * @param props {AddressDropdownProps}
 */
export const AddressDropdown: React.FC<AddressDropdownProps> = ({
    addresses,
    selectedUid,
    onSelect,
    onAddAddress,
}) => {
    const { theme } = useTheme();
    const [modalVisible, setModalVisible] = useState(false);

    const selected = addresses.find(a => a.uid === selectedUid);

    const handleSelect = (uid: string): void => {
        onSelect(uid);
        setModalVisible(false);
    };

    return (
        <View style={styles.container}>
            <RipplePressable
                style={[styles.selectedBox, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.7}
            >
                {selected ? (
                    <View style={styles.selectedContent}>
                        <Text style={[styles.addressLabel, { color: theme.textPrimary }]}>{selected.label}</Text>
                        <Text style={[styles.addressText, { color: theme.textSecondary }]} numberOfLines={1}>{selected.fullAddress}</Text>
                        <Text style={[styles.phoneText, { color: theme.gray }]}>{selected.phone}</Text>
                    </View>
                ) : (
                    <Text style={[styles.emptyText, { color: theme.gray }]}>No address selected. Tap to choose.</Text>
                )}
                <Text style={[styles.dropdownIcon, { color: theme.gray }]}>▼</Text>
            </RipplePressable>

            <Modal visible={modalVisible} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.bottomSheet, { backgroundColor: theme.cardBackground }]}>
                        <View style={styles.headerRow}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select Address</Text>
                            <RipplePressable onPress={() => setModalVisible(false)}>
                                <Text style={[styles.closeText, { color: theme.primary }]}>Close</Text>
                            </RipplePressable>
                        </View>

                        <FlatList
                            data={addresses}
                            keyExtractor={item => item.uid}
                            renderItem={({ item }) => (
                                <RipplePressable
                                    style={[
                                        styles.addressItem,
                                        { borderBottomColor: theme.border },
                                        item.uid === selectedUid && { backgroundColor: `${theme.primary}10` }
                                    ]}
                                    onPress={() => handleSelect(item.uid)}
                                >
                                    <View style={styles.radioContainer}>
                                        <View style={[
                                            styles.radio,
                                            { borderColor: item.uid === selectedUid ? theme.primary : theme.gray },
                                            item.uid === selectedUid && { backgroundColor: theme.primary },
                                        ]} />
                                    </View>
                                    <View style={styles.itemContent}>
                                        <Text style={[styles.itemLabel, { color: theme.textPrimary }]}>{item.label}</Text>
                                        <Text style={[styles.itemText, { color: theme.textSecondary }]}>{item.fullAddress}</Text>
                                        <Text style={[styles.itemPhone, { color: theme.gray }]}>{item.phone}</Text>
                                    </View>
                                </RipplePressable>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={[styles.emptyListText, { color: theme.gray }]}>No addresses found.</Text>
                                </View>
                            }
                        />

                        <RipplePressable
                            style={[styles.addButton, { backgroundColor: theme.primary }]}
                            onPress={() => { setModalVisible(false); onAddAddress(); }}
                        >
                            <Text style={[styles.addText, { color: theme.white }]}>+ Add New Address</Text>
                        </RipplePressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    selectedBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    selectedContent: {
        flex: 1,
    },
    addressLabel: {
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 4,
    },
    addressText: {
        fontSize: 14,
        marginBottom: 2,
    },
    phoneText: {
        fontSize: 12,
    },
    emptyText: {
        flex: 1,
        fontSize: 14,
    },
    dropdownIcon: {
        fontSize: 14,
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 24,
        maxHeight: '80%',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeText: {
        fontSize: 16,
    },
    addressItem: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    radioContainer: {
        justifyContent: 'center',
        marginRight: 12,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
    },
    itemContent: {
        flex: 1,
    },
    itemLabel: {
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 2,
    },
    itemText: {
        fontSize: 14,
        marginBottom: 2,
    },
    itemPhone: {
        fontSize: 12,
    },
    addButton: {
        marginTop: 16,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    addText: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    emptyContainer: {
        padding: 24,
        alignItems: 'center',
    },
    emptyListText: {},
});
