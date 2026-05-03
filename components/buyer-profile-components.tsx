import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RipplePressable } from '@/components/ui/ripple-pressable';
import { useTheme } from './ui/theme-provider';

// ─── ProfileHeader ─────────────────────────────────────────────────────────────
export interface ProfileHeaderProps {
    readonly name: string;
    readonly email: string;
    readonly avatarUrl: string | null;
    readonly onAvatarPress: () => void;
}

/**
 * ProfileHeader — displays user avatar with edit badge, name, and email.
 * Tapping the avatar triggers the onAvatarPress handler for avatar upload.
 */
export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ name, email, avatarUrl, onAvatarPress }) => {
    const { theme } = useTheme();
    return (
        <View style={[headerStyles.container, { backgroundColor: theme.cardBackground }]}>
            <RipplePressable onPress={onAvatarPress} activeOpacity={0.7} style={headerStyles.avatarContainer}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={headerStyles.avatar} />
                ) : (
                    <View style={[headerStyles.placeholderAvatar, { backgroundColor: theme.gray }]}>
                        <Ionicons name="person" size={40} color={theme.white} />
                    </View>
                )}
                <View style={[headerStyles.editBadge, { backgroundColor: theme.primary, borderColor: theme.white }]}>
                    <Ionicons name="camera" size={14} color={theme.white} />
                </View>
            </RipplePressable>
            <View style={headerStyles.infoContainer}>
                <Text style={[headerStyles.name, { color: theme.textPrimary }]}>{name}</Text>
                <Text style={[headerStyles.email, { color: theme.textSecondary }]}>{email}</Text>
            </View>
        </View>
    );
};

const headerStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    placeholderAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    infoContainer: {
        flex: 1,
    },
    name: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    email: {
        fontSize: 14,
    },
});

// ─── ProfileMenu ─────────────────────────────────────────────────────────────
export interface MenuItem {
    readonly icon: keyof typeof Ionicons.glyphMap;
    readonly label: string;
    readonly onPress: () => void;
    readonly isDestructive?: boolean;
}

export interface ProfileMenuProps {
    readonly items: readonly MenuItem[];
}

/**
 * ProfileMenu — renders a list of tappable menu items with icons and optional destructive styling.
 */
export const ProfileMenu: React.FC<ProfileMenuProps> = ({ items }) => {
    const { theme } = useTheme();
    return (
        <View style={[menuStyles.container, { backgroundColor: theme.cardBackground }]}>
            {items.map((item, index) => (
                <RipplePressable
                    key={item.label}
                    style={[menuStyles.menuItem, index !== items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={item.icon}
                        size={24}
                        color={item.isDestructive ? theme.error : theme.textSecondary}
                        style={menuStyles.icon}
                    />
                    <Text style={[menuStyles.label, { color: item.isDestructive ? theme.error : theme.textPrimary }]}>
                        {item.label}
                    </Text>
                    {!item.isDestructive && (
                        <Ionicons name="chevron-forward" size={20} color={theme.gray} />
                    )}
                </RipplePressable>
            ))}
        </View>
    );
};

const menuStyles = StyleSheet.create({
    container: {
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 20,
        paddingHorizontal: 16,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
    },
    icon: {
        marginRight: 16,
    },
    label: {
        flex: 1,
        fontSize: 16,
    },
});

// ─── ProfileCompletenessBar ──────────────────────────────────────────────────
export interface ProfileCompletenessBarProps {
    readonly percentage: number; // 0 to 100
}

/**
 * ProfileCompletenessBar — shows a progress bar for profile completeness percentage.
 * Hidden when percentage reaches 100.
 */
export const ProfileCompletenessBar: React.FC<ProfileCompletenessBarProps> = ({ percentage }) => {
    const { theme } = useTheme();
    if (percentage >= 100) return null;

    return (
        <View style={[completenessStyles.container, { backgroundColor: theme.cardBackground }]}>
            <View style={completenessStyles.header}>
                <Text style={[completenessStyles.title, { color: theme.textPrimary }]}>Profile Completeness</Text>
                <Text style={[completenessStyles.percentage, { color: theme.primary }]}>{percentage}%</Text>
            </View>
            <View style={[completenessStyles.barBackground, { backgroundColor: theme.border }]}>
                <View
                    style={[
                        completenessStyles.barFill,
                        { width: `${percentage}%` as `${number}%`, backgroundColor: theme.primary },
                    ]}
                />
            </View>
            <Text style={[completenessStyles.subtitle, { color: theme.textSecondary }]}>
                Complete your profile to get personalized recommendations!
            </Text>
        </View>
    );
};

const completenessStyles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginBottom: 20,
        padding: 16,
        borderRadius: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    percentage: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    barBackground: {
        height: 8,
        borderRadius: 4,
        marginBottom: 8,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
    },
    subtitle: {
        fontSize: 12,
    },
});

// ─── AvatarUploader ──────────────────────────────────────────────────────────
export interface AvatarUploaderProps {
    readonly visible: boolean;
    readonly onClose: () => void;
    readonly onUpload: (uri: string) => Promise<void>;
}

/**
 * AvatarUploader — an overlay modal that lets users pick and upload a profile photo.
 * Uses expo-image-picker and resizes via expo-image-manipulator.
 */
export const AvatarUploader: React.FC<AvatarUploaderProps> = ({ visible, onClose, onUpload }) => {
    const { theme } = useTheme();
    if (!visible) return null;

    const handlePickImage = async (): Promise<void> => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });

            if (!result.canceled && result.assets.length > 0) {
                const asset = result.assets[0];
                const uri = asset.uri;

                const manipResult = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: 500, height: 500 } }],
                    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
                );

                await onUpload(manipResult.uri);
                onClose();
            }
        } catch (error) {
            console.error('Error picking image', error);
        }
    };

    return (
        <View style={uploaderStyles.overlay}>
            <View style={[uploaderStyles.modal, { backgroundColor: theme.cardBackground }]}>
                <Text style={[uploaderStyles.title, { color: theme.textPrimary }]}>Change Profile Picture</Text>
                <RipplePressable style={[uploaderStyles.button, { backgroundColor: theme.primary }]} onPress={handlePickImage}>
                    <Ionicons name="images" size={24} color={theme.white} style={uploaderStyles.btnIcon} />
                    <Text style={[uploaderStyles.buttonText, { color: theme.white }]}>Choose from Gallery</Text>
                </RipplePressable>
                <RipplePressable style={[uploaderStyles.button, { backgroundColor: theme.background }]} onPress={onClose}>
                    <Text style={[uploaderStyles.cancelButtonText, { color: theme.textPrimary }]}>Cancel</Text>
                </RipplePressable>
            </View>
        </View>
    );
};

const uploaderStyles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modal: {
        width: '80%',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        width: '100%',
        justifyContent: 'center',
        marginBottom: 12,
    },
    btnIcon: {
        marginRight: 8,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});
