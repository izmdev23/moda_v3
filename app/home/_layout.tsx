import { TabBar } from '@/components/navigation-components';
import { useUserRole } from '@/components/ui/user-role-context';
import { Stack, useSegments } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Screens that display the bottom navigation tab bar. */
const TABBED_SCREENS: ReadonlySet<string> = new Set([
    'catalog',
    'cart',
    'my-orders-buyer',
    'buyer-profile',
    'my-orders-seller',
    'seller-profile',
    'upload',
    'shop-landing',
    'seller-dashboard',
]);

/**
 * HomeLayout
 *
 * Layout wrapper for the /home stack of screens. Renders a persistent role-aware
 * bottom TabBar on main screens and hides it on nested detail screens
 * (product-details, checkout, chat-thread, etc.).
 *
 * Tab bar visibility is determined by comparing the last route segment against
 * the known set of TABBED_SCREENS.
 */
export default function HomeLayout(): React.JSX.Element {
    const segments = useSegments();
    const { role } = useUserRole();

    // The last segment identifies the current screen file name
    const currentScreen = segments[segments.length - 1] as string | undefined;
    const showTabBar = role !== null && currentScreen !== undefined && TABBED_SCREENS.has(currentScreen);

    return (
        <View style={styles.container}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            />
            {showTabBar && <TabBar />}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
