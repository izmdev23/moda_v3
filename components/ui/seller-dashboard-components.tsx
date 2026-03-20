import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tables } from '../../supabase/database.types';
import { useTheme } from './theme-provider';

// ==========================================
// DashboardStatsWidget
// ==========================================
interface DashboardStatsWidgetProps {
    readonly totalSales: number;
    readonly totalOrders: number;
    readonly totalProducts: number;
}

export function DashboardStatsWidget({ totalSales, totalOrders, totalProducts }: DashboardStatsWidgetProps): React.JSX.Element {
    const { theme } = useTheme();

    return (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Shop Analytics</Text>
            </View>
            <View style={styles.statsContainer}>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                    <Text style={[styles.statValue, { color: theme.primary }]}>₱{totalSales.toLocaleString()}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Sales</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                    <Text style={[styles.statValue, { color: theme.primary }]}>{totalOrders}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Orders</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                    <Text style={[styles.statValue, { color: theme.primary }]}>{totalProducts}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Products</Text>
                </View>
            </View>
        </View>
    );
}

// ==========================================
// RecentOrdersWidget
// ==========================================
interface RecentOrdersWidgetProps {
    readonly pendingCount: number;
    readonly toShipCount: number;
    readonly onManagePress: () => void;
}

export function RecentOrdersWidget({ pendingCount, toShipCount, onManagePress }: RecentOrdersWidgetProps): React.JSX.Element {
    const { theme } = useTheme();

    return (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Order Overview</Text>
                <TouchableOpacity onPress={onManagePress}>
                    <Text style={[styles.viewAllText, { color: theme.primary }]}>Manage</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.orderStatusContainer}>
                <TouchableOpacity style={styles.orderStatusItem} onPress={onManagePress}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.warning + '20' }]}>
                        <Ionicons name="time-outline" size={24} color={theme.warning} />
                        {pendingCount > 0 && (
                            <View style={[styles.badge, { backgroundColor: theme.error }]}>
                                <Text style={styles.badgeText}>{pendingCount}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.orderStatusText, { color: theme.textPrimary }]}>Pending</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.orderStatusItem} onPress={onManagePress}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.info + '20' }]}>
                        <Ionicons name="cube-outline" size={24} color={theme.info} />
                        {toShipCount > 0 && (
                            <View style={[styles.badge, { backgroundColor: theme.error }]}>
                                <Text style={styles.badgeText}>{toShipCount}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.orderStatusText, { color: theme.textPrimary }]}>To Ship</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ==========================================
// MyProductsWidget
// ==========================================
interface MyProductsWidgetProps {
    readonly products: Tables<'products'>[];
    readonly shopUid: string;
    readonly onUploadPress: () => void;
}

export function MyProductsWidget({ products, shopUid, onUploadPress }: MyProductsWidgetProps): React.JSX.Element {
    const { theme } = useTheme();
    const router = useRouter();

    return (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>My Products</Text>
                <TouchableOpacity onPress={() => router.push(`/home/shop-landing?uid=${shopUid}` as any)}>
                    <Text style={[styles.viewAllText, { color: theme.primary }]}>View Web Store</Text>
                </TouchableOpacity>
            </View>

            {products.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="shirt-outline" size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>You haven't uploaded any products yet.</Text>
                </View>
            ) : (
                <View style={styles.productsSummary}>
                    <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
                        You have <Text style={{ fontWeight: 'bold' }}>{products.length}</Text> active product{products.length !== 1 ? 's' : ''}.
                    </Text>
                </View>
            )}

            <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: theme.primary }]}
                onPress={onUploadPress}
                activeOpacity={0.8}
            >
                <Ionicons name="add-circle-outline" size={20} color={theme.white} style={{ marginRight: 8 }} />
                <Text style={[styles.uploadButtonText, { color: theme.white }]}>Upload New Product</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    viewAllText: {
        fontSize: 14,
        fontWeight: '600',
    },

    // Stats Styles
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statBox: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '500',
    },

    // Orders Styles
    orderStatusContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 10,
    },
    orderStatusItem: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderStatusText: {
        fontSize: 13,
        fontWeight: '500',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: '#FFF',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: 'bold',
    },

    // Products Styles
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
        textAlign: 'center',
    },
    productsSummary: {
        paddingVertical: 12,
        marginBottom: 8,
    },
    summaryText: {
        fontSize: 15,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 8,
    },
    uploadButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
});

export default function SellerDashboardComponents(): React.JSX.Element | null {
    return null;
}
