import { ThemeProvider as AppThemeProvider } from '@/components/ui/theme-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ErrorBoundary } from '@/utils/errorBoundary';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { supabase } from '@supabase/supabaseClient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Ignore specific development errors that are internal to Expo's dev tools
LogBox.ignoreLogs(['Unable to activate keep awake']);

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout(): React.ReactNode {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppThemeProvider>
          <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="auth/login" options={{ headerShown: false }} />
              <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
              <Stack.Screen name="auth/otp" options={{ headerShown: false }} />
              <Stack.Screen name="auth/verify" options={{ headerShown: false }} />
              <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </NavigationThemeProvider>
        </AppThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
