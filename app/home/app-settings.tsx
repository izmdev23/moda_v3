import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    CacheManager,
    SettingsHeader,
    SettingsNavigationItem,
    SettingsToggle
} from '../../components/app-settings-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { supabase } from '../../supabase/supabaseClient';
import { lightPalette } from '../../utils/theme';

export default function AppSettingsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [darkMode, setDarkMode] = useState(false);
    const [pushNotifications, setPushNotifications] = useState(true);
    const [cacheSize, setCacheSize] = useState('0 MB');

    // Dialog states
    const [clearCacheDialogVisible, setClearCacheDialogVisible] = useState(false);
    const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
    const [logoutClearingState, setLogoutClearingState] = useState(false);

    useEffect(() => {
        // Initialize settings
        const initSettings = async () => {
            try {
                // Determine mock cache size
                setCacheSize('12.4 MB');

                // Read dark mode preference
                const dmPref = await AsyncStorage.getItem('darkMode');
                if (dmPref !== null) {
                    setDarkMode(dmPref === 'true');
                }

                // Read push notifications preference
                const pushPref = await AsyncStorage.getItem('pushNotifications');
                if (pushPref !== null) {
                    setPushNotifications(pushPref === 'true');
                }
            } catch (error) {
                console.error("Error reading settings", error);
            }
        };

        void initSettings();
    }, []);

    const toggleDarkMode = async (value: boolean) => {
        setDarkMode(value);
        await AsyncStorage.setItem('darkMode', String(value));
    };

    const togglePushNotifications = async (value: boolean) => {
        setPushNotifications(value);
        await AsyncStorage.setItem('pushNotifications', String(value));
    };

    const handleClearCacheConfirm = () => {
        setClearCacheDialogVisible(false);
        setLoading(true);
        setTimeout(() => {
            setCacheSize('0 MB');
            setLoading(false);
            Alert.alert('Cache Cleared', 'Temporary data has been removed.');
        }, 1000);
    };

    const handleLogout = () => {
        setLogoutDialogVisible(true);
    };

    const handleLogoutConfirm = async () => {
        setLogoutDialogVisible(false);
        setLogoutClearingState(true);

        try {
            await supabase.auth.signOut();
            // Clear securely stored items or preferences if required
            await AsyncStorage.removeItem('savedEmail');
            await AsyncStorage.removeItem('savedPassword');

            router.replace('/auth/login');
        } catch (error) {
            console.error("Logout error", error);
            Alert.alert("Logout Failed", "There was an issue signing out. Please try again.");
            setLogoutClearingState(false);
        }
    };

    return (
        <SafeScreen>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={lightPalette.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>App Settings</Text>
            </View>

            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <SettingsHeader title="Preferences" />
                <SettingsToggle
                    icon="moon-outline"
                    label="Dark Mode"
                    description="Switch to dark theme"
                    value={darkMode}
                    onValueChange={toggleDarkMode}
                />
                <SettingsToggle
                    icon="notifications-outline"
                    label="Push Notifications"
                    description="Receive order updates and chat alerts"
                    value={pushNotifications}
                    onValueChange={togglePushNotifications}
                />
                <SettingsNavigationItem
                    icon="globe-outline"
                    label="Language"
                    value="English"
                    onPress={() => Alert.alert('Coming Soon', 'Additional languages will be added in future updates.')}
                />

                <SettingsHeader title="Account & Data" />
                <SettingsNavigationItem
                    icon="card-outline"
                    label="Payment Methods"
                    onPress={() => router.push('/home/payments' as any)}
                />
                <CacheManager
                    cacheSize={cacheSize}
                    onClearCache={() => setClearCacheDialogVisible(true)}
                />

                <SettingsHeader title="Support & Info" />
                <SettingsNavigationItem
                    icon="information-circle-outline"
                    label="About Moda"
                    value="v1.0.0"
                    onPress={() => Alert.alert('About Moda', 'Version 1.0.0\nDeveloped by Antigravity')}
                />
                <SettingsNavigationItem
                    icon="help-buoy-outline"
                    label="Help Center"
                    onPress={() => Alert.alert('Support', 'Contact us at support@moda.com')}
                />
                <SettingsNavigationItem
                    icon="document-text-outline"
                    label="Terms of Service"
                    onPress={() => Alert.alert('Terms of Service', 'Terms go here.')}
                />
                <SettingsNavigationItem
                    icon="shield-checkmark-outline"
                    label="Privacy Policy"
                    onPress={() => Alert.alert('Privacy Policy', 'Privacy policy goes here.')}
                />

                <SettingsHeader title="Session" />
                <SettingsNavigationItem
                    icon="log-out-outline"
                    label="Log Out"
                    isDestructive
                    onPress={handleLogout}
                />

                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Modals */}
            <ConfirmDialog
                visible={clearCacheDialogVisible}
                title="Clear Cache"
                message="Are you sure you want to clear the app cache? This will remove temporary images and data, but won't delete your account or settings."
                confirmLabel="Clear"
                cancelLabel="Cancel"
                variant="warning"
                onConfirm={handleClearCacheConfirm}
                onCancel={() => setClearCacheDialogVisible(false)}
            />

            <ConfirmDialog
                visible={logoutDialogVisible}
                title="Log Out"
                message="Are you sure you want to log out of Moda? Your saved credentials on this device will be cleared."
                confirmLabel="Log Out"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={handleLogoutConfirm}
                onCancel={() => setLogoutDialogVisible(false)}
            />

            {(loading || logoutClearingState) && (
                <View style={styles.overlay}>
                    <LoadingIndicator message={logoutClearingState ? "Logging out..." : "Processing..."} />
                </View>
            )}
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E9ECEF',
    },
    backButton: {
        marginRight: 16,
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
    },
    bottomSpacer: {
        height: 60,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
