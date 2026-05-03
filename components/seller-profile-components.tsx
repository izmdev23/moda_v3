import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Control } from 'react-hook-form';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RipplePressable } from '@/components/ui/ripple-pressable';
import { FormInput } from './ui/form-input';
import { useTheme } from './ui/theme-provider';

// ─── SellerProfileHeader ─────────────────────────────────────────────────────────────
export interface SellerProfileHeaderProps {
    readonly shopName: string;
    readonly email: string;
    readonly avatarUrl: string | null;
    readonly onAvatarPress: () => void;
}

export const SellerProfileHeader: React.FC<SellerProfileHeaderProps> = ({ shopName, email, avatarUrl, onAvatarPress }) => {
    const { theme } = useTheme();
    return (
        <View style={[headerStyles.container, { backgroundColor: theme.cardBackground }]}>
            <RipplePressable onPress={onAvatarPress} activeOpacity={0.7} style={headerStyles.avatarContainer}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={headerStyles.avatar} />
                ) : (
                    <View style={[headerStyles.placeholderAvatar, { backgroundColor: theme.gray }]}>
                        <Ionicons name="storefront" size={40} color={theme.white} />
                    </View>
                )}
                <View style={[headerStyles.editBadge, { backgroundColor: theme.primary, borderColor: theme.white }]}>
                    <Ionicons name="camera" size={14} color={theme.white} />
                </View>
            </RipplePressable>
            <View style={headerStyles.infoContainer}>
                <Text style={[headerStyles.name, { color: theme.textPrimary }]}>{shopName}</Text>
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
    avatarContainer: { position: 'relative', marginRight: 16 },
    avatar: { width: 80, height: 80, borderRadius: 40 },
    placeholderAvatar: {
        width: 80, height: 80, borderRadius: 40,
        alignItems: 'center', justifyContent: 'center',
    },
    editBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2,
    },
    infoContainer: { flex: 1 },
    name: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
    email: { fontSize: 14 },
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
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
    icon: { marginRight: 16 },
    label: { flex: 1, fontSize: 16 },
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
    control, errors, onSubmit, isSubmitting
}) => {
    const { theme } = useTheme();
    return (
        <View style={[formStyles.container, { backgroundColor: theme.cardBackground }]}>
            <Text style={[formStyles.title, { color: theme.textPrimary }]}>Become a Seller</Text>
            <Text style={[formStyles.subtitle, { color: theme.textSecondary }]}>Set up your shop details to start selling.</Text>

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

            <RipplePressable
                style={[formStyles.submitButton, { backgroundColor: isSubmitting ? theme.gray : theme.primary }, isSubmitting && formStyles.submitButtonDisabled]}
                onPress={onSubmit}
                disabled={isSubmitting}
                activeOpacity={0.7}
            >
                <Text style={[formStyles.submitText, { color: theme.white }]}>
                    {isSubmitting ? 'Creating Shop...' : 'Create Shop'}
                </Text>
            </RipplePressable>
        </View>
    );
};

const formStyles = StyleSheet.create({
    container: {
        padding: 16,
        marginHorizontal: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    subtitle: { fontSize: 14, marginBottom: 16 },
    submitButton: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
    submitButtonDisabled: { opacity: 0.6 },
    submitText: { fontSize: 16, fontWeight: 'bold' },
});
