import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Control } from 'react-hook-form';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { lightPalette } from '../utils/theme';
import { FormInput } from './ui/form-input';

// ─── SellerProfileHeader ─────────────────────────────────────────────────────────────
export interface SellerProfileHeaderProps {
    readonly shopName: string;
    readonly email: string;
    readonly avatarUrl: string | null;
    readonly onAvatarPress: () => void;
}

export const SellerProfileHeader: React.FC<SellerProfileHeaderProps> = ({ shopName, email, avatarUrl, onAvatarPress }) => {
    return (
        <View style={headerStyles.container}>
            <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7} style={headerStyles.avatarContainer}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={headerStyles.avatar} />
                ) : (
                    <View style={headerStyles.placeholderAvatar}>
                        <Ionicons name="storefront" size={40} color="#FFFFFF" />
                    </View>
                )}
                <View style={headerStyles.editBadge}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
            </TouchableOpacity>
            <View style={headerStyles.infoContainer}>
                <Text style={headerStyles.name}>{shopName}</Text>
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

// ─── SellerMenu ─────────────────────────────────────────────────────────────
export interface MenuItem {
    readonly icon: keyof typeof Ionicons.glyphMap;
    readonly label: string;
    readonly onPress: () => void;
    readonly isDestructive?: boolean;
}

export interface SellerMenuProps {
    readonly items: readonly MenuItem[];
}

export const SellerMenu: React.FC<SellerMenuProps> = ({ items }) => {
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

// ─── SwitchToSellerForm ────────────────────────────────────────────────────────
interface SwitchToSellerFormData {
    shopName: string;
    description: string;
}

export interface SwitchToSellerFormProps {
    readonly control: Control<SwitchToSellerFormData>;
    readonly errors: Partial<Record<keyof SwitchToSellerFormData, { message?: string }>>;
    readonly onSubmit: () => void;
    readonly isSubmitting: boolean;
}

export const SwitchToSellerForm: React.FC<SwitchToSellerFormProps> = ({
    control,
    errors,
    onSubmit,
    isSubmitting
}) => {
    return (
        <View style={formStyles.container}>
            <Text style={formStyles.title}>Become a Seller</Text>
            <Text style={formStyles.subtitle}>Set up your shop details to start selling.</Text>

            <FormInput
                name="shopName"
                control={control}
                label="Shop Name *"
                placeholder="Enter your shop name"
                rules={{ required: 'Shop name is required' }}
                error={errors.shopName?.message}
            />

            <FormInput
                name="description"
                control={control}
                label="Description"
                placeholder="Tell us about your shop..."
                error={errors.description?.message}
            />

            <TouchableOpacity
                style={[formStyles.submitButton, isSubmitting && formStyles.submitButtonDisabled]}
                onPress={onSubmit}
                disabled={isSubmitting}
                activeOpacity={0.7}
            >
                <Text style={formStyles.submitText}>
                    {isSubmitting ? 'Creating Shop...' : 'Create Shop'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const formStyles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: lightPalette.textSecondary,
        marginBottom: 16,
    },
    submitButton: {
        backgroundColor: lightPalette.primary,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
    },
    submitButtonDisabled: {
        backgroundColor: '#ADB5BD',
    },
    submitText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
