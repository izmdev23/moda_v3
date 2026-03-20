import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { OrderCard, OrderItemData } from '../../components/my-orders-components';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';

const SELLER_ORDERS_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

export default function MyOrdersSellerScreen() {
    const { theme } = useTheme();
    const [orders, setOrders] = useState<OrderItemData[]>([]);

    // grouping function
    const groupedOrders = orders.reduce((acc, order) => {
        const buyer = order.buyerName || 'Unknown Buyer';
        if (!acc[buyer]) acc[buyer] = [];
        acc[buyer].push(order);
        return acc;
    }, {} as Record<string, OrderItemData[]>);

    const handleActionClick = (orderId: string, action: 'confirm' | 'ship' | 'receive' | 'rate') => {
        setOrders(prev => prev.map(o => {
            if (o.id !== orderId) return o;
            if (action === 'confirm') return { ...o, status: 'confirmed', deadline: new Date(Date.now() + 1000 * 60 * 60 * 48) }; // seller has 48h to ship
            if (action === 'ship') return { ...o, status: 'shipped' };
            return o;
        }));
    };

    const renderGroup = ({ item: buyerName }: { item: string }) => {
        const buyerOrders = groupedOrders[buyerName];
        return (
            <View style={[styles.groupContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={[styles.groupHeader, { borderBottomColor: theme.border }]}>
                    <MaterialIcons name="person" size={20} color={theme.textPrimary} />
                    <Text style={[styles.groupBuyerName, { color: theme.textPrimary }]}>{buyerName}</Text>
                </View>
                <View style={styles.groupOrders}>
                    {buyerOrders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            isSeller={true}
                            onPress={() => { }}
                            onActionClick={(action) => handleActionClick(order.id, action)}
                        />
                    ))}
                </View>
            </View>
        );
    };

    return (
        <SafeScreen style={styles.container} edges={SELLER_ORDERS_SAFE_AREA_EDGES}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.headerText, { color: theme.textPrimary }]}>Customer Orders</Text>
            </View>

            <FlatList
                data={Object.keys(groupedOrders)}
                keyExtractor={item => item}
                contentContainerStyle={styles.listContent}
                renderItem={renderGroup}
                ListEmptyComponent={
                    <EmptyList
                        icon={<MaterialIcons name="inventory" size={48} color={theme.textSecondary} />}
                        message="No pending orders"
                        submessage="Share your products to get more sales!"
                    />
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
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
        gap: 16,
    },
    groupContainer: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        gap: 8,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    groupBuyerName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    groupOrders: {
        padding: 12,
        gap: 12,
    }
});
