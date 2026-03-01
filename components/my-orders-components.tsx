import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './ui/theme-provider';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';

export interface OrderItemData {
    id: string;
    name: string;
    thumbnail: string;
    quantity: number;
    price: number;
    status: OrderStatus;
    deadline?: Date;
    shopName?: string;
    buyerName?: string;
}

interface OrderStatusBadgeProps {
    status: OrderStatus;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
    const { theme } = useTheme();

    let bgColor = theme.gray;
    let textColor = theme.white;
    let text = 'Pending';
    let iconName: keyof typeof MaterialIcons.glyphMap = 'hourglass-empty';

    switch (status) {
        case 'pending':
            bgColor = theme.warning;
            text = 'Pending';
            iconName = 'hourglass-empty';
            break;
        case 'confirmed':
            bgColor = theme.info;
            text = 'Confirmed';
            iconName = 'check-circle';
            break;
        case 'shipped':
            bgColor = theme.primary; // Or a dedicated shipping color
            text = 'Shipped';
            iconName = 'local-shipping';
            break;
        case 'delivered':
            bgColor = theme.success;
            text = 'Delivered';
            iconName = 'done-all';
            break;
    }

    return (
        <View style={[styles.badge, { backgroundColor: bgColor }]}>
            <MaterialIcons name={iconName} size={14} color={textColor} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: textColor }]}>{text}</Text>
        </View>
    );
};

interface DeliveryTimerProps {
    deadline?: Date;
    status: OrderStatus;
}

export const DeliveryTimer: React.FC<DeliveryTimerProps> = ({ deadline, status }) => {
    const { theme } = useTheme();
    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
        if (!deadline || status === 'delivered') return;

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const end = deadline.getTime();
            const distance = end - now;

            if (distance < 0) {
                setTimeLeft('Expired');
                clearInterval(interval);
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

            setTimeLeft(`${days}d ${hours}h ${minutes}m left`);
        }, 1000);

        return () => clearInterval(interval);
    }, [deadline, status]);

    if (!deadline || status === 'delivered') return null;

    return (
        <View style={styles.timerContainer}>
            <MaterialIcons name="timer" size={14} color={theme.warning} />
            <Text style={[styles.timerText, { color: theme.warning }]}>{timeLeft}</Text>
        </View>
    );
};

interface OrderCardProps {
    order: OrderItemData;
    isSeller: boolean;
    onPress: () => void;
    onActionClick: (action: 'confirm' | 'ship' | 'receive' | 'rate') => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, isSeller, onPress, onActionClick }) => {
    const { theme } = useTheme();

    return (
        <TouchableOpacity
            style={[styles.cardContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
                <View style={styles.headerLeft}>
                    <MaterialIcons name={isSeller ? "person" : "store"} size={16} color={theme.textSecondary} />
                    <Text style={[styles.headerName, { color: theme.textSecondary }]}>
                        {isSeller ? order.buyerName : order.shopName}
                    </Text>
                </View>
                <OrderStatusBadge status={order.status} />
            </View>

            <View style={styles.cardBody}>
                <Image source={{ uri: order.thumbnail }} style={styles.thumbnail} contentFit="cover" />
                <View style={styles.details}>
                    <Text style={[styles.productName, { color: theme.textPrimary }]} numberOfLines={2}>
                        {order.name}
                    </Text>
                    <View style={styles.priceRow}>
                        <Text style={[styles.price, { color: theme.primary }]}>₱{order.price.toFixed(2)}</Text>
                        <Text style={[styles.qty, { color: theme.textSecondary }]}>x{order.quantity}</Text>
                    </View>
                </View>
            </View>

            {/* Actions / Timers Footer */}
            {(order.deadline || order.status !== 'pending') && (
                <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                        <DeliveryTimer deadline={order.deadline} status={order.status} />
                    </View>

                    <OrderStatusActions isSeller={isSeller} status={order.status} onAction={(action) => onActionClick(action)} />
                </View>
            )}

            {order.status === 'delivered' && !isSeller && (
                <View style={[styles.cardFooter, { borderTopColor: theme.border, justifyContent: 'flex-end' }]}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.cardBackground, borderColor: theme.primary }]}
                        onPress={() => onActionClick('rate')}
                    >
                        <Text style={{ color: theme.primary, fontSize: 13, fontWeight: 'bold' }}>Rate & Review</Text>
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );
};

interface OrderStatusActionsProps {
    isSeller: boolean;
    status: OrderStatus;
    onAction: (action: 'confirm' | 'ship' | 'receive' | 'rate') => void;
}

export const OrderStatusActions: React.FC<OrderStatusActionsProps> = ({ isSeller, status, onAction }) => {
    const { theme } = useTheme();

    if (isSeller) {
        if (status === 'pending') {
            return (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => onAction('confirm')}>
                    <Text style={styles.actionBtnText}>Confirm Order</Text>
                </TouchableOpacity>
            );
        }
        if (status === 'confirmed') {
            return (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => onAction('ship')}>
                    <Text style={styles.actionBtnText}>Mark as Shipped</Text>
                </TouchableOpacity>
            );
        }
    } else {
        if (status === 'shipped') {
            return (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.success }]} onPress={() => onAction('receive')}>
                    <Text style={styles.actionBtnText}>Order Received</Text>
                </TouchableOpacity>
            );
        }
    }

    return null;
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timerText: {
        fontSize: 12,
        fontWeight: '600',
    },
    cardContainer: {
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerName: {
        fontSize: 13,
        fontWeight: '600',
    },
    cardBody: {
        flexDirection: 'row',
        padding: 12,
        gap: 12,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 4,
        backgroundColor: '#E0E0E0',
    },
    details: {
        flex: 1,
        justifyContent: 'space-between',
    },
    productName: {
        fontSize: 14,
        fontWeight: '500',
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    price: {
        fontSize: 16,
        fontWeight: '700',
    },
    qty: {
        fontSize: 13,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
    },
    actionBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    actionBtnText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: 'bold',
    }
});
