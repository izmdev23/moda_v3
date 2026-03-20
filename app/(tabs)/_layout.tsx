import { useTheme } from '@/components/ui/theme-provider';
import { Stack } from 'expo-router';
import React from 'react';

/**
 * TabsLayout
 *
 * Thin shell layout for the (tabs) route group. The visual tab bar and
 * role-based tab navigation live in app/home/_layout.tsx via the custom
 * TabBar component. This group primarily serves as an entry-point route
 * segment — app/index.tsx redirects directly to /home/catalog or
 * /home/seller-dashboard based on the authenticated user's role.
 */
export default function TabsLayout(): React.JSX.Element {
    const { theme } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.background },
            }}
        />
    );
}
