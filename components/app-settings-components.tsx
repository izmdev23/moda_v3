import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { lightPalette } from '../utils/theme';

// ─── SettingsHeader ─────────────────────────────────────────────────────────
export interface SettingsHeaderProps {
    readonly title: string;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ title }) => {
    return (
        <View style={headerStyles.container}>
            <Text style={headerStyles.title}>{title}</Text>
        </View>
    );
};

const headerStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F8F9FA',
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
        color: lightPalette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});

// ─── SettingsToggle ─────────────────────────────────────────────────────────
export interface SettingsToggleProps {
    readonly icon: keyof typeof Ionicons.glyphMap;
    readonly label: string;
    readonly value: boolean;
    readonly onValueChange: (value: boolean) => void;
    readonly description?: string;
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
    icon,
    label,
    value,
    onValueChange,
    description,
}) => {
    return (
        <View style={toggleStyles.container}>
            <View style={toggleStyles.iconContainer}>
                <Ionicons name={icon} size={22} color={lightPalette.textSecondary} />
            </View>
            <View style={toggleStyles.textContainer}>
                <Text style={toggleStyles.label}>{label}</Text>
                {description && <Text style={toggleStyles.description}>{description}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: '#E9ECEF', true: lightPalette.primary }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E9ECEF"
            />
        </View>
    );
};

const toggleStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E9ECEF',
    },
    iconContainer: {
        width: 36,
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    label: {
        fontSize: 16,
        color: lightPalette.textPrimary,
        fontWeight: '500',
    },
    description: {
        fontSize: 12,
        color: lightPalette.textSecondary,
        marginTop: 2,
    },
});

// ─── SettingsNavigationItem ───────────────────────────────────────────────────
export interface SettingsNavigationItemProps {
    readonly icon: keyof typeof Ionicons.glyphMap;
    readonly label: string;
    readonly onPress: () => void;
    readonly value?: string;
    readonly isDestructive?: boolean;
    readonly style?: ViewStyle;
}

export const SettingsNavigationItem: React.FC<SettingsNavigationItemProps> = ({
    icon,
    label,
    onPress,
    value,
    isDestructive = false,
    style,
}) => {
    return (
        <TouchableOpacity
            style={[navStyles.container, style]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={navStyles.iconContainer}>
                <Ionicons
                    name={icon}
                    size={22}
                    color={isDestructive ? lightPalette.error : lightPalette.textSecondary}
                />
            </View>
            <View style={navStyles.textContainer}>
                <Text style={[navStyles.label, isDestructive && navStyles.labelDestructive]}>
                    {label}
                </Text>
            </View>
            {value && (
                <Text style={navStyles.valueText}>{value}</Text>
            )}
            <Ionicons name="chevron-forward" size={20} color="#ADB5BD" />
        </TouchableOpacity>
    );
};

const navStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E9ECEF',
    },
    iconContainer: {
        width: 36,
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    label: {
        fontSize: 16,
        color: lightPalette.textPrimary,
        fontWeight: '500',
    },
    labelDestructive: {
        color: lightPalette.error,
    },
    valueText: {
        fontSize: 15,
        color: lightPalette.textSecondary,
        marginRight: 8,
    },
});

// ─── CacheManager ───────────────────────────────────────────────────────────
export interface CacheManagerProps {
    readonly cacheSize: string;
    readonly onClearCache: () => void;
}

export const CacheManager: React.FC<CacheManagerProps> = ({ cacheSize, onClearCache }) => {
    return (
        <SettingsNavigationItem
            icon="trash-bin-outline"
            label="Clear Cache"
            value={cacheSize}
            onPress={onClearCache}
        />
    );
};
