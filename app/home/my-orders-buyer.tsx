import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { OrderCard, OrderItemData } from '../../components/my-orders-components';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';

// Dummy data
const MOCK_ORDERS: OrderItemData[] = [
    {
        id: 'ord_1',
        name: 'Vintage Checkered Shirt',
        thumbnail: 'https://picsum.photos/id/1/100',
        quantity: 1,
        price: 450.00,
        status: 'shipped',
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 48), // 48h from now
        shopName: 'Retro Revival'
    },
    {
        id: 'ord_2',
        name: 'Denim Jacket 90s',
        thumbnail: 'https://picsum.photos/id/2/100',
        quantity: 1,
        price: 1200.00,
        status: 'pending',
        shopName: 'Denim Depot'
    },
    {
        id: 'ord_3',
        name: 'Classic White Sneakers',
        thumbnail: 'https://picsum.photos/id/3/100',
        quantity: 1,
        price: 850.00,
        status: 'delivered',
        shopName: 'Kicks Kicks Kicks'
    }
];

export default function MyOrdersBuyerScreen() {
    const { theme } = useTheme();
    const [orders, setOrders] = useState<OrderItemData[]>(MOCK_ORDERS);

    const handleActionClick = (orderId: string, action: 'confirm' | 'ship' | 'receive' | 'rate') => {
        if (action === 'receive') {
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o));
        } else if (action === 'rate') {
            router.push({ pathname: '/home/review-form', params: { productId: orderId } } as any); // Stub productId
        }
    };

    return (
        <SafeScreen style={styles.container}>
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
                data={orders}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <OrderCard
                        order={item}
                        isSeller={false}
                        onPress={() => router.push({ pathname: '/home/product-delivery-info', params: { orderId: item.id } } as any)}
                        onActionClick={(action) => handleActionClick(item.id, action)}
                    />
                )}
                ListEmptyComponent={
                    <EmptyList icon="inbox" message="No active orders" submessage="Go buy some awesome clothes!" />
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
    }
});
