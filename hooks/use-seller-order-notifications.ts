import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../supabase/supabaseClient';
import { queryKeys } from '../utils/query-keys';
import { useCurrentUser } from './use-current-user';

const PUSH_NOTIFICATIONS_PREF_KEY = 'pushNotifications';
const SELLER_NOTIFICATION_CHANNEL_ID = 'seller-orders';

interface SellerShopRow {
    readonly id: number;
}

interface OrderItemInsertPayload {
    readonly product_name?: string;
}

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

async function fetchSellerShopId(userId: number): Promise<number | null> {
    const { data, error } = await supabase
        .from('shops')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error !== null) {
        throw new Error(error.message);
    }

    if (data === null) {
        return null;
    }

    return (data as SellerShopRow).id;
}

async function isPushNotificationsEnabled(): Promise<boolean> {
    const storedPreference = await AsyncStorage.getItem(PUSH_NOTIFICATIONS_PREF_KEY);

    if (storedPreference === null) {
        return true;
    }

    return storedPreference === 'true';
}

export function useSellerOrderNotifications(): void {
    const { data: currentUser } = useCurrentUser();
    const sellerUserId = currentUser?.role === 'seller' ? currentUser.id : null;

    const { data: sellerShopId } = useQuery<number | null>({
        queryKey: queryKeys.shop(sellerUserId ?? 0),
        queryFn: () => fetchSellerShopId(sellerUserId ?? 0),
        enabled: sellerUserId !== null,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (sellerUserId === null) {
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
                await Notifications.setNotificationChannelAsync(SELLER_NOTIFICATION_CHANNEL_ID, {
                    name: 'Seller Orders',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }
        };

        void setupNotifications();
    }, [sellerUserId]);

    useEffect(() => {
        if (sellerShopId === null || sellerShopId === undefined) {
            return;
        }

        const channel = supabase
            .channel(`seller-order-notifications-${sellerShopId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'order_items',
                    filter: `shop_id=eq.${sellerShopId}`,
                },
                (payload) => {
                    const sendNotification = async (): Promise<void> => {
                        const isEnabled = await isPushNotificationsEnabled();
                        if (!isEnabled) {
                            return;
                        }

                        const payloadData = payload.new as OrderItemInsertPayload;
                        const productName = payloadData.product_name?.trim() ?? '';
                        const resolvedProductName = productName.length > 0 ? productName : 'A product';

                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: 'New Order',
                                body: `${resolvedProductName} has received a new order.`,
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
    }, [sellerShopId]);
}
