import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../supabase/supabaseClient';
import { useCurrentUser } from './use-current-user';

const PUSH_NOTIFICATIONS_PREF_KEY = 'pushNotifications';
const APP_NOTIFICATION_CHANNEL_ID = 'moda-updates';

interface AppNotificationInsertPayload {
    readonly title?: string;
    readonly message?: string;
}

async function isPushNotificationsEnabled(): Promise<boolean> {
    const storedPreference = await AsyncStorage.getItem(PUSH_NOTIFICATIONS_PREF_KEY);

    if (storedPreference === null) {
        return true;
    }

    return storedPreference === 'true';
}

export function useAppNotifications(): void {
    const { data: currentUser } = useCurrentUser();
    const recipientUserId = currentUser?.id ?? null;

    useEffect(() => {
        if (recipientUserId === null) {
            return;
        }

        const setupNotifications = async (): Promise<void> => {
            const { status: currentStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = currentStatus;

            if (currentStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                return;
            }

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync(APP_NOTIFICATION_CHANNEL_ID, {
                    name: 'Moda Updates',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 200, 200, 200],
                    lightColor: '#3A7D44',
                });
            }
        };

        void setupNotifications();
    }, [recipientUserId]);

    useEffect(() => {
        if (recipientUserId === null) {
            return;
        }

        const channel = supabase
            .channel(`app-notifications-${recipientUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'app_notifications',
                    filter: `recipient_user_id=eq.${recipientUserId}`,
                },
                (payload) => {
                    const sendNotification = async (): Promise<void> => {
                        const pushNotificationsEnabled = await isPushNotificationsEnabled();
                        if (!pushNotificationsEnabled) {
                            return;
                        }

                        const payloadData = payload.new as AppNotificationInsertPayload;
                        const title = payloadData.title?.trim() ?? '';
                        const message = payloadData.message?.trim() ?? '';

                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: title.length > 0 ? title : 'Moda Update',
                                body: message.length > 0 ? message : 'You have a new notification.',
                            },
                            trigger: null,
                        });
                    };

                    void sendNotification();
                },
            )
            .subscribe();

        return (): void => {
            void supabase.removeChannel(channel);
        };
    }, [recipientUserId]);
}
