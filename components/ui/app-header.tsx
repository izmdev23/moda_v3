import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { IconSymbol } from './icon-symbol';
import { ProfileMenu } from './profile-menu';
import { useTheme } from './theme-provider';

interface AppHeaderProps {
    readonly title?: string;
    readonly showProfileIcon?: boolean;
    readonly userAvatarUrl?: string | null;
    readonly userRole?: 'buyer' | 'seller';
}

/**
 * Global App Header component with app icon, title, and profile menu integration.
 * 
 * @param props {AppHeaderProps}
 * @returns {React.JSX.Element}
 */
export function AppHeader({
    title = 'MODA',
    showProfileIcon = true,
    userAvatarUrl = null,
    userRole = 'buyer'
}: AppHeaderProps): React.JSX.Element {
    const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false);
    const { theme: currentTheme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: currentTheme.cardBackground, borderBottomColor: currentTheme.border }]}>
            <View style={styles.leftSection}>
                <Image
                    source={require('../../assets/images/app-icon-dark.png')}
                    style={styles.appIcon}
                    resizeMode="contain"
                />
                <Text style={[styles.appTitle, { color: currentTheme.textPrimary }]}>{title}</Text>
            </View>

            <View style={styles.rightSection}>
                {userRole === 'buyer' && (
                    <TouchableOpacity
                        style={styles.cartBtn}
                        onPress={() => router.push('/home/cart')}
                        activeOpacity={0.7}
                    >
                        <IconSymbol name="cart.fill" size={24} color={currentTheme.textPrimary} />
                    </TouchableOpacity>
                )}

                {showProfileIcon && (
                    <TouchableOpacity
                        style={[styles.profileBtn, { borderColor: currentTheme.border, backgroundColor: currentTheme.background }]}
                        onPress={() => setIsMenuVisible(true)}
                        activeOpacity={0.7}
                    >
                        {userAvatarUrl ? (
                            <Image source={{ uri: userAvatarUrl }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: currentTheme.primary }]}>
                                <IconSymbol name="person.fill" size={20} color={currentTheme.white} />
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            <ProfileMenu
                isVisible={isMenuVisible}
                onClose={() => setIsMenuVisible(false)}
                userRole={userRole}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cartBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    appIcon: {
        width: 32,
        height: 32,
        marginRight: 10,
    },
    appTitle: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    profileBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
