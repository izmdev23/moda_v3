import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../supabase/supabaseClient';
import { useCurrentUser } from './use-current-user';

const PUSH_NOTIFICATIONS_PREF_KEY = 'pushNotifications';
const CHAT_NOTIFICATION_CHANNEL_ID = 'chat-messages';

interface ChatMessageInsertPayload {
    readonly uid: string;
    readonly thread_id: number;
    readonly sender_id: number;
    readonly message_type: string;
    readonly content: string | null;
}

async function isPushNotificationsEnabled(): Promise<boolean> {
    const storedPreference = await AsyncStorage.getItem(PUSH_NOTIFICATIONS_PREF_KEY);

    if (storedPreference === null) {
        return true;
    }

    return storedPreference === 'true';
}

function buildNotificationBody(payload: ChatMessageInsertPayload): string {
    const normalizedType = payload.message_type.trim().toLowerCase();
    if (normalizedType === 'image') {
        return 'Sent you an image.';
    }

    const messageText = payload.content?.trim() ?? '';
    if (messageText.length > 0) {
        return messageText;
    }

    return 'Sent you a message.';
}

export function useChatMessageNotifications(): void {
    const { data: currentUser } = useCurrentUser();
    const currentUserId = currentUser?.id ?? null;

    useEffect(() => {
        if (currentUserId === null) {
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
                await Notifications.setNotificationChannelAsync(CHAT_NOTIFICATION_CHANNEL_ID, {
                    name: 'Chat Messages',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 220, 220, 220],
                    lightColor: '#3A7D44',
                });
            }
        };

        void setupNotifications();
    }, [currentUserId]);

    useEffect(() => {
        if (currentUserId === null) {
            return;
        }

        const channel = supabase
            .channel(`chat-message-notifications-${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                },
                (payload) => {
                    const sendNotification = async (): Promise<void> => {
                        const pushNotificationsEnabled = await isPushNotificationsEnabled();
                        if (!pushNotificationsEnabled) {
                            return;
                        }

                        const insertedMessage = payload.new as ChatMessageInsertPayload;
                        if (insertedMessage.sender_id === currentUserId) {
                            return;
                        }

                        const { data: threadRow, error: threadError } = await supabase
                            .from('chat_threads')
                            .select('id')
                            .eq('id', insertedMessage.thread_id)
                            .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`)
                            .maybeSingle();

                        if (threadError !== null || threadRow === null) {
                            return;
                        }

                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: 'New Message',
                                body: buildNotificationBody(insertedMessage),
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
    }, [currentUserId]);
}