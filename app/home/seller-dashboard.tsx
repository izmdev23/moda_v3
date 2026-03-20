import { shopsTable } from '@/utils/database/shops-table';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { InteractionManager, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '../../components/ui/app-header';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { DashboardStatsWidget, MyProductsWidget, RecentOrdersWidget } from '../../components/ui/seller-dashboard-components';
import { useTheme } from '../../components/ui/theme-provider';
import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { productsTable } from '../../utils/database/products-table';

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

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            // Warm up upload-related modules so first navigation feels instant.
            void import('./upload');
            void import('../../components/upload-components');
        });

        return () => {
            task.cancel();
        };
    }, []);

    const handleRefresh = (): void => {
        setRefreshing(true);
        void fetchDashboardData();
    };

    if (loading) {
        return (
            <SafeScreen>
                <AppHeader title="Dashboard" showProfileIcon={false} />
                <View style={[styles.center, { backgroundColor: theme.background }]}>
                    <LoadingIndicator message="Loading dashboard..." />
                </View>
            </SafeScreen>
        );
    }

    if (!shop) {
        // Fallback if somehow they don't have a shop record but are a seller
        return (
            <SafeScreen>
                <AppHeader title="Dashboard" showProfileIcon={false} />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={{ backgroundColor: theme.background }}>
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
                    totalSales={stats.totalSales}
                    totalOrders={stats.totalOrders}
                    totalProducts={products.length}
                />

                {/* 2. Order Overview */}
                <RecentOrdersWidget
                    pendingCount={ordersInfo.pending}
                    toShipCount={ordersInfo.toShip}
                    onManagePress={() => router.push('/home/my-orders-seller')}
                />

                {/* 3. My Products */}
                <MyProductsWidget
                    products={products}
                    shopUid={shop.uid}
                    onUploadPress={() => router.push('/home/upload')}
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
        padding: 16,
        paddingBottom: 40,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
