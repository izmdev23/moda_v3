import { router, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase/supabaseClient';
import { IconSymbol } from './ui/icon-symbol';
import { useTheme } from './ui/theme-provider';
import { useUserRole } from './ui/user-role-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_HEIGHT: number = 64;
const BADGE_SIZE: number = 18;
const ICON_SIZE: number = 26;

// ─── Types ────────────────────────────────────────────────────────────────────

type IconName =
    | 'house.fill'
    | 'cart.fill'
    | 'list.bullet.rectangle.fill'
    | 'person.fill'
    | 'storefront.fill'
    | 'square.and.arrow.up.fill';

interface TabConfig {
    readonly label: string;
    readonly iconName: IconName;
    readonly route: string;
    readonly matchSegments: readonly string[];
}

interface CartBadgeProps {
    readonly count: number;
}

interface HeaderBackButtonProps {
    /** Optional override label displayed next to the back arrow */
    readonly label?: string;
}

// ─── Tab Configurations ───────────────────────────────────────────────────────

const BUYER_TABS: readonly TabConfig[] = [
    {
        label: 'Catalog',
        iconName: 'house.fill',
        route: '/home/catalog',
        matchSegments: ['catalog'],
    },
    {
        label: 'Cart',
        iconName: 'cart.fill',
        route: '/home/cart',
        matchSegments: ['cart'],
    },
    {
        label: 'Orders',
        iconName: 'list.bullet.rectangle.fill',
        route: '/home/my-orders-buyer',
        matchSegments: ['my-orders-buyer'],
    },
    {
        label: 'Profile',
        iconName: 'person.fill',
        route: '/home/buyer-profile',
        matchSegments: ['buyer-profile'],
    },
];

const SELLER_TABS: readonly TabConfig[] = [
    {
        label: 'Dashboard',
        iconName: 'storefront.fill',
        route: '/home/seller-dashboard',
        matchSegments: ['seller-dashboard'],
    },
    {
        label: 'Upload',
        iconName: 'square.and.arrow.up.fill',
        route: '/home/upload',
        matchSegments: ['upload'],
    },
    {
        label: 'Orders',
        iconName: 'list.bullet.rectangle.fill',
        route: '/home/my-orders-seller',
        matchSegments: ['my-orders-seller'],
    },
    {
        label: 'Profile',
        iconName: 'person.fill',
        route: '/home/seller-profile',
        matchSegments: ['seller-profile'],
    },
];

// ─── CartBadge Component ──────────────────────────────────────────────────────

/**
 * CartBadge
 *
 * Displays a circular red badge overlaid on the cart icon showing the number
 * of items currently in the user's cart. Hidden when count is 0.
 */
export const CartBadge: React.FC<CartBadgeProps> = ({ count }) => {
    const { theme } = useTheme();

    if (count <= 0) return null;

    return (
        <View
            style={[
                styles.badge,
                { backgroundColor: theme.error },
            ]}
        >
            <Text style={[styles.badgeText, { color: theme.white }]}>
                {count > 99 ? '99+' : String(count)}
            </Text>
        </View>
    );
};

// ─── HeaderBackButton Component ───────────────────────────────────────────────

/**
 * HeaderBackButton
 *
 * A consistently styled back button for stack screens. Uses the app's primary
 * color and theme for the icon and optional label. Calls router.back() on press.
 */
export const HeaderBackButton: React.FC<HeaderBackButtonProps> = ({ label }) => {
    const { theme } = useTheme();

    const handlePress = (): void => {
        router.back();
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={label ?? 'Go back'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <IconSymbol name="arrow.left" size={22} color={theme.primary} />
            {label !== undefined && (
                <Text style={[styles.backLabel, { color: theme.primary }]}>{label}</Text>
            )}
        </TouchableOpacity>
    );
};

// ─── TabBar Component ─────────────────────────────────────────────────────────

/**
 * TabBar
 *
 * Role-aware persistent bottom navigation bar. Shows Buyer tabs
 * (Catalog / Cart / Orders / Profile) or Seller tabs (Dashboard / Upload /
 * Orders / Profile) based on the authenticated user's role. The Cart tab
 * displays a live badge count fetched from cart_items. The active tab is
 * derived from the current pathname.
 *
 * Respects safe-area insets and adapts to light/dark theme automatically.
 */
export const TabBar: React.FC = () => {
    const { theme } = useTheme();
    const { role, numericUserId } = useUserRole();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const [cartCount, setCartCount] = useState<number>(0);

    // Fetch cart item count for buyers using the internal numeric user id
    useEffect(() => {
        if (role !== 'buyer' || numericUserId === null) return;

        const fetchCartCount = async (): Promise<void> => {
            const { data, error } = await supabase
                .from('cart_items')
                .select('id', { count: 'exact', head: false })
                .eq('user_id', numericUserId);

            if (!error && data !== null) {
                setCartCount(data.length);
            }
        };

        void fetchCartCount();

        // Subscribe to cart changes for live badge updates
        const channel = supabase
            .channel('cart-badge')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cart_items' },
                () => { void fetchCartCount(); }
            )
            .subscribe();

        return () => { void supabase.removeChannel(channel); };
    }, [role, numericUserId]);

    const tabs = role === 'seller' ? SELLER_TABS : BUYER_TABS;

    const isTabActive = (tab: TabConfig): boolean =>
        tab.matchSegments.some((seg) => pathname.includes(seg));

    const handleTabPress = (tab: TabConfig): void => {
        // Tapping the already-active tab is a no-op — prevents duplicate screen stacking
        if (isTabActive(tab)) return;

        router.push(tab.route as `/${string}`);
    };

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: theme.cardBackground,
                    borderTopColor: theme.border,
                    paddingBottom: insets.bottom,
                    height: TAB_HEIGHT + insets.bottom,
                },
            ]}
        >
            {tabs.map((tab) => {
                const active = isTabActive(tab);
                const iconColor = active ? theme.primary : theme.gray;

                return (
                    <TouchableOpacity
                        key={tab.label}
                        style={styles.tab}
                        onPress={() => handleTabPress(tab)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={tab.label}
                    >
                        <View style={styles.iconWrapper}>
                            <IconSymbol
                                name={tab.iconName}
                                size={ICON_SIZE}
                                color={iconColor}
                            />
                            {/* Cart badge for the cart tab (buyers only) */}
                            {tab.iconName === 'cart.fill' && (
                                <CartBadge count={cartCount} />
                            )}
                        </View>
                        <Text style={[styles.tabLabel, { color: iconColor }]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderTopWidth: StyleSheet.hairlineWidth,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 8,
    },
    iconWrapper: {
        position: 'relative',
    },
    tabLabel: {
        fontSize: 11,
        marginTop: 3,
        fontWeight: '500',
    },
    badge: {
        position: 'absolute',
        top: -5,
        right: -8,
        minWidth: BADGE_SIZE,
        height: BADGE_SIZE,
        borderRadius: BADGE_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backLabel: {
        marginLeft: 4,
        fontSize: 16,
        fontWeight: '500',
    },
});
