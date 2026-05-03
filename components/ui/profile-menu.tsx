import { RipplePressable } from '@/components/ui/ripple-pressable';
import { router } from 'expo-router';
import React from 'react';
import {
    Modal, Pressable, ScrollView, StyleSheet, Text, View
} from 'react-native';
import { supabase } from '../../supabase/supabaseClient';
import { IconSymbol } from './icon-symbol';
import { useTheme } from './theme-provider';

interface ProfileMenuProps {
    readonly isVisible: boolean;
    readonly onClose: () => void;
    readonly userRole?: 'buyer' | 'seller';
}

interface ProfileMenuItem {
    readonly label: string;
    readonly icon:
        | 'person.fill'
        | 'bag.fill'
        | 'doc.text.fill'
        | 'gearshape.fill'
        | 'creditcard.fill'
        | 'map.fill';
    readonly onPress: () => void;
}

/**
 * A modal-based menu for user profile actions and navigation.
 * 
 * @param props {ProfileMenuProps}
 * @returns {React.JSX.Element}
 */
export function ProfileMenu({ isVisible, onClose, userRole }: ProfileMenuProps): React.JSX.Element {
    const { theme: currentTheme } = useTheme();

    const handleLogout = async (): Promise<void> => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            router.replace('/auth/login');
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            onClose();
        }
    };

    const navigateTo = (path: string): void => {
        router.push(path as never);
        onClose();
    };

    const handleViewProfilePress = (): void => navigateTo('/home/buyer-profile');
    const handleOrdersPress = (): void => navigateTo('/home/my-orders-buyer');
    const handleWalletPress = (): void => navigateTo('/home/wallet');
    const handleTransactionsPress = (): void => navigateTo('/home/order-history');
    const handleSettingsPress = (): void => navigateTo('/home/app-settings');
    const handlePaymentsPress = (): void => navigateTo('/home/payments');
    const handleAddressesPress = (): void => navigateTo('/home/addresses');

    const menuItems: readonly ProfileMenuItem[] = [
        {
            label: 'View Profile',
            icon: 'person.fill' as const,
            onPress: handleViewProfilePress,
        },
        {
            label: 'My Orders',
            icon: 'bag.fill' as const,
            onPress: handleOrdersPress,
        },
        {
            label: 'Wallet',
            icon: 'creditcard.fill' as const,
            onPress: handleWalletPress,
        },
        {
            label: 'Transactions',
            icon: 'doc.text.fill' as const,
            onPress: handleTransactionsPress,
        },
        {
            label: 'Settings',
            icon: 'gearshape.fill' as const,
            onPress: handleSettingsPress,
        },
        {
            label: 'Payments & Cards',
            icon: 'creditcard.fill' as const,
            onPress: handlePaymentsPress,
        },
        {
            label: 'My Addresses',
            icon: 'map.fill' as const,
            onPress: handleAddressesPress,
        },
    ];

    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={[styles.menuContainer, { backgroundColor: currentTheme.cardBackground }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: currentTheme.textPrimary }]}>Account</Text>
                        <RipplePressable onPress={onClose} style={styles.closeBtn}>
                            <IconSymbol name="chevron.right" size={24} color={currentTheme.textPrimary} style={{ transform: [{ rotate: '90deg' }] }} />
                        </RipplePressable>
                    </View>

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        {menuItems.map((item, index) => (
                            <RipplePressable
                                key={index}
                                style={[styles.menuItem, { borderBottomColor: currentTheme.border }]}
                                onPress={item.onPress}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: `${currentTheme.primary}10` }]}>
                                    <IconSymbol name={item.icon} size={20} color={currentTheme.primary} />
                                </View>
                                <Text style={[styles.menuText, { color: currentTheme.textPrimary }]}>{item.label}</Text>
                                <IconSymbol name="chevron.right" size={16} color={currentTheme.gray} />
                            </RipplePressable>
                        ))}

                        <RipplePressable
                            style={[styles.menuItem, styles.logoutItem]}
                            onPress={() => {
                                void handleLogout();
                            }}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: `${currentTheme.error}10` }]}>
                                <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color={currentTheme.error} />
                            </View>
                            <Text style={[styles.menuText, { color: currentTheme.error }]}>Logout</Text>
                        </RipplePressable>
                    </ScrollView>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 60,
        paddingRight: 20,
    },
    menuContainer: {
        width: 280,
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    closeBtn: {
        padding: 4,
    },
    scrollView: {
        maxHeight: 400,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
    },
    logoutItem: {
        borderBottomWidth: 0,
        marginTop: 8,
    },
});
