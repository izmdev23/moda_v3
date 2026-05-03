import { TabBar } from '@/components/navigation-components';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useUserRole } from '@/components/ui/user-role-context';
import { Animation } from '@/utils/animation';
import { router, Stack, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';

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
    const [isExitDialogVisible, setIsExitDialogVisible] = useState<boolean>(false);

    // The last segment identifies the current screen file name
    const currentScreen = segments[segments.length - 1] as string | undefined;
    const showTabBar = role !== null && currentScreen !== undefined && TABBED_SCREENS.has(currentScreen);

    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            // Intercept only when on a tabbed root screen and there is no dismissible stack left.
            if (showTabBar && !router.canDismiss()) {
                setIsExitDialogVisible(true);
                return true;
            }

            return false;
        });

        return (): void => {
            subscription.remove();
        };
    }, [showTabBar]);

    const handleCancelExit = (): void => {
        setIsExitDialogVisible(false);
    };

    const handleConfirmExit = (): void => {
        setIsExitDialogVisible(false);
        BackHandler.exitApp();
    };

    return (
        <View style={styles.container}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: Animation.DefaultAnimationSpeed,
                    freezeOnBlur: true,
                }}
            />
            {showTabBar && <TabBar />}
            <ConfirmDialog
                visible={isExitDialogVisible}
                title="Exit App"
                message="Do you want to close Moda?"
                confirmLabel="Exit"
                cancelLabel="Cancel"
                variant="warning"
                onCancel={handleCancelExit}
                onConfirm={handleConfirmExit}
            />
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
