import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { lightPalette } from '../utils/theme';

// ─── ProfileHeader ─────────────────────────────────────────────────────────────
export interface ProfileHeaderProps {
    readonly name: string;
    readonly email: string;
    readonly avatarUrl: string | null;
    readonly onAvatarPress: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ name, email, avatarUrl, onAvatarPress }) => {
    return (
        <View style={headerStyles.container}>
            <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7} style={headerStyles.avatarContainer}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={headerStyles.avatar} />
                ) : (
                    <View style={headerStyles.placeholderAvatar}>
                        <Ionicons name="person" size={40} color="#FFFFFF" />
                    </View>
                )}
                <View style={headerStyles.editBadge}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
            </TouchableOpacity>
            <View style={headerStyles.infoContainer}>
                <Text style={headerStyles.name}>{name}</Text>
                <Text style={headerStyles.email}>{email}</Text>
            </View>
        </View>
    );
};

const headerStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFFFFF',
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
        backgroundColor: '#ADB5BD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: lightPalette.primary,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    infoContainer: {
        flex: 1,
    },
    name: {
        fontSize: 20,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
        marginBottom: 4,
    },
    email: {
        fontSize: 14,
        color: lightPalette.textSecondary,
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

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ items }) => {
    return (
        <View style={menuStyles.container}>
            {items.map((item, index) => (
                <TouchableOpacity
                    key={item.label}
                    style={[menuStyles.menuItem, index !== items.length - 1 && menuStyles.borderBottom]}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={item.icon}
                        size={24}
                        color={item.isDestructive ? lightPalette.error : lightPalette.textSecondary}
                        style={menuStyles.icon}
                    />
                    <Text style={[menuStyles.label, item.isDestructive && menuStyles.labelDestructive]}>
                        {item.label}
                    </Text>
                    {!item.isDestructive && (
                        <Ionicons name="chevron-forward" size={20} color="#ADB5BD" />
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );
};

const menuStyles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
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
    borderBottom: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E9ECEF',
    },
    icon: {
        marginRight: 16,
    },
    label: {
        flex: 1,
        fontSize: 16,
        color: lightPalette.textPrimary,
    },
    labelDestructive: {
        color: lightPalette.error,
    },
});

// ─── ProfileCompletenessBar ──────────────────────────────────────────────────
export interface ProfileCompletenessBarProps {
    readonly percentage: number; // 0 to 100
}

export const ProfileCompletenessBar: React.FC<ProfileCompletenessBarProps> = ({ percentage }) => {
    if (percentage >= 100) return null;

    return (
        <View style={completenessStyles.container}>
            <View style={completenessStyles.header}>
                <Text style={completenessStyles.title}>Profile Completeness</Text>
                <Text style={completenessStyles.percentage}>{percentage}%</Text>
            </View>
            <View style={completenessStyles.barBackground}>
                <View
                    style={[
                        completenessStyles.barFill,
                        { width: `${percentage}%` as any },
                    ]}
                />
            </View>
            <Text style={completenessStyles.subtitle}>
                Complete your profile to get personalized recommendations!
            </Text>
        </View>
    );
};

const completenessStyles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
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
        color: lightPalette.textPrimary,
    },
    percentage: {
        fontSize: 14,
        fontWeight: 'bold',
        color: lightPalette.primary,
    },
    barBackground: {
        height: 8,
        backgroundColor: '#E9ECEF',
        borderRadius: 4,
        marginBottom: 8,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: lightPalette.primary,
    },
    subtitle: {
        fontSize: 12,
        color: lightPalette.textSecondary,
    },
});

// ─── AvatarUploader ──────────────────────────────────────────────────────────
export interface AvatarUploaderProps {
    readonly visible: boolean;
    readonly onClose: () => void;
    readonly onUpload: (uri: string) => Promise<void>;
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({ visible, onClose, onUpload }) => {
    if (!visible) return null;

    const handlePickImage = async () => {
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
            <View style={uploaderStyles.modal}>
                <Text style={uploaderStyles.title}>Change Profile Picture</Text>
                <TouchableOpacity style={uploaderStyles.button} onPress={handlePickImage}>
                    <Ionicons name="images" size={24} color="#FFFFFF" style={uploaderStyles.btnIcon} />
                    <Text style={uploaderStyles.buttonText}>Choose from Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[uploaderStyles.button, uploaderStyles.cancelButton]} onPress={onClose}>
                    <Text style={uploaderStyles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
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
        backgroundColor: '#FFFFFF',
        width: '80%',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        color: lightPalette.textPrimary,
    },
    button: {
        backgroundColor: lightPalette.primary,
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
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButton: {
        backgroundColor: '#F8F9FA',
    },
    cancelButtonText: {
        color: lightPalette.textPrimary,
        fontSize: 16,
        fontWeight: 'bold',
    },
});
