import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { OrderCard, OrderItemData } from '../../components/my-orders-components';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useBuyerOrders, useMarkOrderReceived } from '../../hooks/use-orders';
import { AppAlert } from '../../utils/app-alert';

const BUYER_ORDERS_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

export default function MyOrdersBuyerScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { data: currentUser } = useCurrentUser();
    const userId = currentUser?.id ?? null;
    const {
        data: orders = [],
        isLoading,
        isRefetching,
        refetch,
    } = useBuyerOrders(userId);
    const markOrderReceivedMutation = useMarkOrderReceived();

    useFocusEffect(
        useCallback((): void => {
            if (userId === null) {
                return;
            }

            void refetch();
        }, [userId, refetch]),
    );

    const handleActionClick = useCallback((orderId: string, action: 'confirm' | 'ship' | 'receive' | 'rate'): void => {
        const selectedOrder = orders.find((order) => order.id === orderId) ?? null;

        if (action === 'receive') {
            if (selectedOrder?.orderUid === undefined) {
                AppAlert.alert('Error', 'Unable to locate this order right now.');
                return;
            }

            markOrderReceivedMutation.mutate(
                { orderUid: selectedOrder.orderUid },
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
            router.push({ pathname: '/home/review-form', params: { productId: orderId } } as Parameters<typeof router.push>[0]); // Stub productId
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
    }));

    return (
        <SafeScreen style={styles.container} edges={BUYER_ORDERS_SAFE_AREA_EDGES}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.headerText, { color: theme.textPrimary }]}>My Orders</Text>
            </View>

            <View style={[styles.disclaimer, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
                <MaterialIcons name="info-outline" size={16} color={theme.warning} />
                <Text style={[styles.disclaimerText, { color: theme.warning }]}>
                    Estimated delivery time. Actual delivery may vary.
                </Text>
            </View>

            <FlatList
                data={mappedOrders}
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
                                icon={<MaterialIcons name="inbox" size={48} color={theme.textSecondary} />}
                                message="No active orders"
                                submessage="Go buy some awesome clothes!"
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
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    loadingPlaceholder: {
        height: 12,
    }
});
