import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { OrderCard, OrderItemData } from '../../components/my-orders-components';
import { EmptyList } from '../../components/ui/empty-list';
import { RipplePressable } from '../../components/ui/ripple-pressable';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useBuyerOrders, useMarkOrderReceived } from '../../hooks/use-orders';
import { useBuyerNotifications } from '../../hooks/use-refunds';
import { AppAlert } from '../../utils/app-alert';

const BUYER_ORDERS_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];
type BuyerOrdersTab = 'orders' | 'refunds';

export default function MyOrdersBuyerScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState<BuyerOrdersTab>('orders');
    const { data: currentUser } = useCurrentUser();
    const userId = currentUser?.id ?? null;
    const {
        data: orders = [],
        isLoading,
        isRefetching,
        refetch,
    } = useBuyerOrders(userId);
    const { data: notifications = [] } = useBuyerNotifications(userId);
    const markOrderReceivedMutation = useMarkOrderReceived();

    const unreadCount = notifications.reduce((totalCount, notification) => {
        if (notification.isRead) {
            return totalCount;
        }

        return totalCount + 1;
    }, 0);

    useFocusEffect(
        useCallback((): void => {
            if (userId === null) {
                return;
            }

            void refetch();
        }, [userId, refetch]),
    );

    const handleActionClick = useCallback((orderId: string, action: 'confirm' | 'ship' | 'receive' | 'rate' | 'refund'): void => {
        const selectedOrder = orders.find((order) => order.id === orderId) ?? null;

        if (action === 'receive') {
            if (selectedOrder === null) {
                AppAlert.alert('Error', 'Unable to locate this order right now.');
                return;
            }

            markOrderReceivedMutation.mutate(
                { orderItemUid: selectedOrder.id },
                {
                    onSuccess: () => {
                        AppAlert.alert('Order Updated', 'Your order is now marked as received.');
                    },
                    onError: (error) => {
                        AppAlert.alert('Error', error.message);
                    },
                },
            );
        } else if (action === 'rate') {
            router.push({ pathname: '/home/review-form', params: { orderItemUid: orderId } } as Parameters<typeof router.push>[0]);
        } else if (action === 'refund') {
            router.push({ pathname: '/home/refund-request', params: { orderItemUid: orderId } } as Parameters<typeof router.push>[0]);
        }
    }, [markOrderReceivedMutation, orders]);

    const mappedOrders: OrderItemData[] = orders.map((order) => ({
        id: order.id,
        orderUid: order.orderUid,
        name: order.name,
        thumbnail: order.thumbnail,
        quantity: order.quantity,
        price: order.price,
        totalPrice: order.totalPrice,
        variantName: order.variantName,
        status: order.status,
        deadline: order.deadline,
        shopName: order.shopName,
        refundStatus: order.refundStatus,
    }));
    const refundRequestedOrders: OrderItemData[] = mappedOrders.filter((order) => order.refundStatus !== 'none');
    const isShowingRefunds = activeTab === 'refunds';
    const visibleOrders: readonly OrderItemData[] = isShowingRefunds ? refundRequestedOrders : mappedOrders;

    return (
        <SafeScreen style={styles.container} edges={BUYER_ORDERS_SAFE_AREA_EDGES}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.headerText, { color: theme.textPrimary }]}>My Orders</Text>
                <RipplePressable style={styles.notificationButton} onPress={() => router.push('/home/notifications' as Parameters<typeof router.push>[0])}>
                    <MaterialIcons name="notifications-none" size={22} color={theme.primary} />
                    {unreadCount > 0 && (
                        <View style={[styles.notificationBadge, { backgroundColor: theme.error }]}> 
                            <Text style={[styles.notificationBadgeText, { color: theme.white }]}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                        </View>
                    )}
                </RipplePressable>
            </View>

            <View style={[styles.disclaimer, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
                <MaterialIcons name="info-outline" size={16} color={theme.warning} />
                <Text style={[styles.disclaimerText, { color: theme.warning }]}>
                    Estimated delivery time. Actual delivery may vary.
                </Text>
            </View>

            <View style={[styles.tabsRow, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}> 
                <RipplePressable
                    style={[
                        styles.tabButton,
                        activeTab === 'orders' && { backgroundColor: `${theme.primary}1A`, borderColor: theme.primary },
                    ]}
                    onPress={() => setActiveTab('orders')}
                >
                    <Text
                        style={[
                            styles.tabButtonText,
                            { color: activeTab === 'orders' ? theme.primary : theme.textSecondary },
                        ]}
                    >
                        My Orders ({mappedOrders.length})
                    </Text>
                </RipplePressable>

                <RipplePressable
                    style={[
                        styles.tabButton,
                        activeTab === 'refunds' && { backgroundColor: `${theme.primary}1A`, borderColor: theme.primary },
                    ]}
                    onPress={() => setActiveTab('refunds')}
                >
                    <Text
                        style={[
                            styles.tabButtonText,
                            { color: activeTab === 'refunds' ? theme.primary : theme.textSecondary },
                        ]}
                    >
                        My Refunds ({refundRequestedOrders.length})
                    </Text>
                </RipplePressable>
            </View>

            <FlatList
                data={visibleOrders}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <OrderCard
                        order={item}
                        isSeller={false}
                        onPress={() => router.push({ pathname: '/home/product-delivery-info', params: { orderId: item.id } } as Parameters<typeof router.push>[0])}
                        onActionClick={(action) => handleActionClick(item.id, action)}
                    />
                )}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={() => { void refetch(); }}
                        tintColor={theme.primary}
                    />
                }
                ListEmptyComponent={
                    isLoading
                        ? <View style={styles.loadingPlaceholder} />
                        : (
                            <EmptyList
                                icon={<MaterialIcons name={isShowingRefunds ? 'assignment-return' : 'inbox'} size={48} color={theme.textSecondary} />}
                                message={isShowingRefunds ? 'No refund requests yet' : 'No active orders'}
                                submessage={isShowingRefunds ? 'Requested refunds will appear here.' : 'Go buy some awesome clothes!'}
                            />
                        )
                }
            />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    headerText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    disclaimer: {
        flexDirection: 'row',
        padding: 12,
        margin: 16,
        borderWidth: 1,
        borderRadius: 8,
        alignItems: 'center',
        gap: 8,
    },
    disclaimerText: {
        fontSize: 12,
        flex: 1,
    },
    tabsRow: {
        flexDirection: 'row',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
        padding: 6,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9,
        borderWidth: 1,
        borderColor: 'transparent',
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    tabButtonText: {
        fontSize: 12,
        fontWeight: '700',
    },
    notificationButton: {
        padding: 4,
        position: 'relative',
    },
    notificationBadge: {
        position: 'absolute',
        top: 0,
        right: -4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    notificationBadgeText: {
        fontSize: 9,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    loadingPlaceholder: {
        height: 12,
    }
});
