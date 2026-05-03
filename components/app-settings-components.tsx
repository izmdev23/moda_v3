import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';
import { RipplePressable } from '@/components/ui/ripple-pressable';
import { useTheme } from './ui/theme-provider';

// ─── SettingsHeader ─────────────────────────────────────────────────────────
export interface SettingsHeaderProps {
    readonly title: string;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ title }) => {
    const { theme } = useTheme();
    return (
        <View style={[headerStyles.container, { backgroundColor: theme.background }]}>
            <Text style={[headerStyles.title, { color: theme.textSecondary }]}>{title}</Text>
        </View>
    );
};

const headerStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
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
    const { theme } = useTheme();
    return (
        <View style={[toggleStyles.container, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
            <View style={toggleStyles.iconContainer}>
                <Ionicons name={icon} size={22} color={theme.textSecondary} />
            </View>
            <View style={toggleStyles.textContainer}>
                <Text style={[toggleStyles.label, { color: theme.textPrimary }]}>{label}</Text>
                {description && <Text style={[toggleStyles.description, { color: theme.textSecondary }]}>{description}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={theme.white}
                ios_backgroundColor={theme.border}
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
        borderBottomWidth: StyleSheet.hairlineWidth,
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
        fontWeight: '500',
    },
    description: {
        fontSize: 12,
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
    const { theme } = useTheme();
    return (
        <RipplePressable
            style={[navStyles.container, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }, style]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={navStyles.iconContainer}>
                <Ionicons
                    name={icon}
                    size={22}
                    color={isDestructive ? theme.error : theme.textSecondary}
                />
            </View>
            <View style={navStyles.textContainer}>
                <Text style={[navStyles.label, { color: isDestructive ? theme.error : theme.textPrimary }]}>
                    {label}
                </Text>
            </View>
            {value && (
                <Text style={[navStyles.valueText, { color: theme.textSecondary }]}>{value}</Text>
            )}
            <Ionicons name="chevron-forward" size={20} color={theme.gray} />
        </RipplePressable>
    );
};

const navStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
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
        fontWeight: '500',
    },
    valueText: {
        fontSize: 15,
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
