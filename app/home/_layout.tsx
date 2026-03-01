import { Stack } from 'expo-router';
import React from 'react';

/**
 * Layout wrapper for the /home stack of screens.
 * Registers all nested routes (catalog, product-details, cart, etc.)
 */
export default function HomeLayout(): React.JSX.Element {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        />
    );
}
