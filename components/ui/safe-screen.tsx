import { useTheme } from '@/components/ui/theme-provider';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SafeScreenProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

/**
 * A wrapper component that ensures content is rendered within the safe area of the device.
 * It automatically applies the theme's background color.
 */
export const SafeScreen: React.FC<SafeScreenProps> = ({ children, style }): React.JSX.Element => {
    const { theme: currentTheme } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }, style]}>
            <View style={styles.innerContainer}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    innerContainer: {
        flex: 1,
    },
});
