import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
 * AddressDropdown allows switching selected address inline
 * @param props {AddressDropdownProps}
 */
export const AddressDropdown: React.FC<AddressDropdownProps> = ({
    addresses,
    selectedUid,
    onSelect,
    onAddAddress,
}) => {
    const [modalVisible, setModalVisible] = useState(false);

    const selected = addresses.find(a => a.uid === selectedUid);

    const handleSelect = (uid: string) => {
        onSelect(uid);
        setModalVisible(false);
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.selectedBox}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.7}
            >
                {selected ? (
                    <View style={styles.selectedContent}>
                        <Text style={styles.addressLabel}>{selected.label}</Text>
                        <Text style={styles.addressText} numberOfLines={1}>{selected.fullAddress}</Text>
                        <Text style={styles.phoneText}>{selected.phone}</Text>
                    </View>
                ) : (
                    <Text style={styles.emptyText}>No address selected. Tap to choose.</Text>
                )}
                <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.bottomSheet}>
                        <View style={styles.headerRow}>
                            <Text style={styles.modalTitle}>Select Address</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeText}>Close</Text>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={addresses}
                            keyExtractor={item => item.uid}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.addressItem,
                                        item.uid === selectedUid && styles.addressItemSelected
                                    ]}
                                    onPress={() => handleSelect(item.uid)}
                                >
                                    <View style={styles.radioContainer}>
                                        <View style={[styles.radio, item.uid === selectedUid && styles.radioSelected]} />
                                    </View>
                                    <View style={styles.itemContent}>
                                        <Text style={styles.itemLabel}>{item.label}</Text>
                                        <Text style={styles.itemText}>{item.fullAddress}</Text>
                                        <Text style={styles.itemPhone}>{item.phone}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyListText}>No addresses found.</Text>
                                </View>
                            }
                        />

                        <TouchableOpacity style={styles.addButton} onPress={() => { setModalVisible(false); onAddAddress(); }}>
                            <Text style={styles.addText}>+ Add New Address</Text>
                        </TouchableOpacity>
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
        backgroundColor: '#F9F9F9',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    selectedContent: {
        flex: 1,
    },
    addressLabel: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#333',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    phoneText: {
        fontSize: 12,
        color: '#888',
    },
    emptyText: {
        flex: 1,
        color: '#999',
        fontSize: 14,
    },
    dropdownIcon: {
        fontSize: 14,
        color: '#999',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: '#FFF',
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
        color: '#333',
    },
    closeText: {
        color: '#007AFF',
        fontSize: 16,
    },
    addressItem: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    addressItemSelected: {
        backgroundColor: '#F0F8FF',
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
        borderColor: '#CCC',
    },
    radioSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#007AFF',
    },
    itemContent: {
        flex: 1,
    },
    itemLabel: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#333',
        marginBottom: 2,
    },
    itemText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    itemPhone: {
        fontSize: 12,
        color: '#888',
    },
    addButton: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    addText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    emptyContainer: {
        padding: 24,
        alignItems: 'center',
    },
    emptyListText: {
        color: '#999',
    },
});
