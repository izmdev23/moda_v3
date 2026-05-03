import { shopsTable } from '@/utils/database/shops-table';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/ui/app-header';
import { SafeScreen } from '../../components/ui/safe-screen';
import { DashboardStatsWidget, MyProductsWidget, RecentOrdersWidget } from '../../components/ui/seller-dashboard-components';
import { useTheme } from '../../components/ui/theme-provider';
import { useShopAnalyticsData } from '../../hooks/use-shop-analytics';
import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { productsTable } from '../../utils/database/products-table';

const SELLER_DASHBOARD_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

export default function SellerDashboardScreen(): React.JSX.Element {
    const router = useRouter();
    const { theme } = useTheme();

    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [shop, setShop] = useState<Tables<'shops'> | null>(null);
    const [products, setProducts] = useState<Tables<'products'>[]>([]);

    // Placeholders for real analytics & orders data down the line
    const [stats, setStats] = useState({ totalSales: 0, totalOrders: 0 });
    const [ordersInfo, setOrdersInfo] = useState({ pending: 0, toShip: 0 });

    const { data: analyticsData, isLoading: analyticsLoading } = useShopAnalyticsData(shop?.uid ?? null);

    const fetchDashboardData = async (): Promise<void> => {
        try {
            // Reset to empty-state defaults before each load.
            setProducts([]);
            setStats({ totalSales: 0, totalOrders: 0 });
            setOrdersInfo({ pending: 0, toShip: 0 });

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.replace('/auth/login');
                return;
            }

            // Get user's shop using their DB user id.
            // But we only have authId here. Let's get the DB user first.
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('auth_id', session.user.id)
                .single();

            if (userError || !userData) {
                throw new Error('Could not find user.');
            }

            // Get Shop
            const { data: shopData } = await shopsTable.getByUserId(userData.id);
            if (shopData) {
                setShop(shopData);

                // Get Products for this shop
                const { data: productsData } = await productsTable.getByShopId(shopData.id);
                if (productsData) {
                    setProducts(productsData);
                }

                const { data: orderItemsData, error: orderItemsError } = await supabase
                    .from('order_items')
                    .select('order_id')
                    .eq('shop_id', shopData.id);

                if (orderItemsError === null) {
                    const orderIds = Array.from(new Set((orderItemsData ?? []).map((item) => item.order_id)));

                    if (orderIds.length > 0) {
                        const { data: ordersData, error: ordersError } = await supabase
                            .from('orders')
                            .select('status')
                            .in('id', orderIds);

                        if (ordersError === null) {
                            let pendingCount = 0;
                            let toShipCount = 0;

                            for (const order of ordersData ?? []) {
                                const normalizedStatus = order.status.trim().toLowerCase();

                                if (normalizedStatus === 'pending') {
                                    pendingCount += 1;
                                }

                                if (normalizedStatus === 'confirmed') {
                                    toShipCount += 1;
                                }
                            }

                            setOrdersInfo({ pending: pendingCount, toShip: toShipCount });
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Dashboard Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        void fetchDashboardData();
    }, [router]);

    const handleRefresh = (): void => {
        setRefreshing(true);
        void fetchDashboardData();
    };

    if (!shop && !loading) {
        // Fallback if somehow they don't have a shop record but are a seller
        return (
            <SafeScreen edges={SELLER_DASHBOARD_SAFE_AREA_EDGES}>
                <AppHeader title="Dashboard" showProfileIcon={false} />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={{ backgroundColor: theme.background }} edges={SELLER_DASHBOARD_SAFE_AREA_EDGES}>
            <AppHeader
                title="Dashboard"
                showProfileIcon={true}
                userRole="seller"
            // We could pass shop avatar here if configured
            />

            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
                }
            >
                {/* 1. Shop Analytics Stats */}
                <DashboardStatsWidget
                    totalSales={analyticsData?.totals.totalSalesAmount ?? stats.totalSales}
                    totalOrders={analyticsData?.totals.totalOrders ?? stats.totalOrders}
                    totalRefunds={analyticsData?.totals.totalRefunds ?? 0}
                    totalProducts={products.length}
                    isLoading={loading || analyticsLoading}
                    onViewPress={
                        shop?.uid
                            ? (): void => {
                                router.push({
                                    pathname: '/home/shop-analytics' as const,
                                    params: {
                                        uid: shop.uid,
                                    },
                                } as Parameters<typeof router.push>[0]);
                            }
                            : undefined
                    }
                />

                {/* 2. Order Overview */}
                <RecentOrdersWidget
                    pendingCount={ordersInfo.pending}
                    toShipCount={ordersInfo.toShip}
                    onManagePress={() => router.push('/home/my-orders-seller')}
                    isLoading={loading}
                />

                {/* 3. My Products */}
                <MyProductsWidget
                    products={products}
                    shopUid={shop?.uid ?? null}
                    onUploadPress={() => router.push('/home/upload')}
                    isLoading={loading}
                />

            </ScrollView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
});
