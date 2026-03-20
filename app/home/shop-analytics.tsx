import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
    AnalyticsDashboard,
    AnalyticsData,
    AnalyticsPeriod,
    SalesDataPoint,
    TopProductItem,
    TopTagItem
} from '../../components/shop-analytics-components';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';

export default function ShopAnalyticsScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const [loading, setLoading] = useState<boolean>(true);
    const [period, setPeriod] = useState<AnalyticsPeriod>('daily');
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

    useEffect(() => {
        // Mocking an async data fetch from the backend based on period
        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                // In a real implementation we would fetch from shop_analyticsTable based on the period
                // await shop_analyticsTable.getTopProducts(shopId, period), etc.
                await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate network request

                // MOCK DATA
                const mockSales: Record<AnalyticsPeriod, SalesDataPoint[]> = {
                    daily: [
                        { label: '8am', value: 120 }, { label: '10am', value: 450 },
                        { label: '12pm', value: 900 }, { label: '2pm', value: 300 },
                        { label: '4pm', value: 600 }
                    ],
                    weekly: [
                        { label: 'Mon', value: 1200 }, { label: 'Tue', value: 2450 },
                        { label: 'Wed', value: 1900 }, { label: 'Thu', value: 3300 },
                        { label: 'Fri', value: 4600 }, { label: 'Sat', value: 5000 },
                        { label: 'Sun', value: 4200 }
                    ],
                    monthly: [
                        { label: 'Week 1', value: 12400 }, { label: 'Week 2', value: 14500 },
                        { label: 'Week 3', value: 10900 }, { label: 'Week 4', value: 16300 }
                    ],
                    yearly: [
                        { label: 'Q1', value: 52400 }, { label: 'Q2', value: 64500 },
                        { label: 'Q3', value: 70900 }, { label: 'Q4', value: 96300 }
                    ],
                };

                const mockProducts: Record<AnalyticsPeriod, TopProductItem[]> = {
                    daily: [
                        { id: 1, name: 'Vintage Washed Tee', imageUrl: 'https://picsum.photos/100', totalSales: 5, totalRevenue: 1500 }
                    ],
                    weekly: [
                        { id: 1, name: 'Vintage Washed Tee', imageUrl: 'https://picsum.photos/100', totalSales: 45, totalRevenue: 13500 },
                        { id: 2, name: 'Graphic Hoodie', imageUrl: 'https://picsum.photos/101', totalSales: 22, totalRevenue: 33000 }
                    ],
                    monthly: [
                        { id: 1, name: 'Vintage Washed Tee', imageUrl: 'https://picsum.photos/100', totalSales: 180, totalRevenue: 54000 },
                        { id: 2, name: 'Graphic Hoodie', imageUrl: 'https://picsum.photos/101', totalSales: 95, totalRevenue: 142500 },
                        { id: 3, name: 'Denim Jacket', imageUrl: 'https://picsum.photos/102', totalSales: 40, totalRevenue: 80000 }
                    ],
                    yearly: [
                        { id: 1, name: 'Vintage Washed Tee', imageUrl: 'https://picsum.photos/100', totalSales: 2400, totalRevenue: 720000 },
                        { id: 3, name: 'Denim Jacket', imageUrl: 'https://picsum.photos/102', totalSales: 1600, totalRevenue: 3200000 },
                        { id: 2, name: 'Graphic Hoodie', imageUrl: 'https://picsum.photos/101', totalSales: 1250, totalRevenue: 1875000 },
                    ],
                };

                const mockTags: Record<AnalyticsPeriod, TopTagItem[]> = {
                    daily: [{ tag: 'vintage', totalSales: 5 }],
                    weekly: [{ tag: 'vintage', totalSales: 45 }, { tag: 'hoodie', totalSales: 22 }, { tag: 'graphic', totalSales: 20 }],
                    monthly: [{ tag: 'vintage', totalSales: 210 }, { tag: 'hoodie', totalSales: 95 }, { tag: 'denim', totalSales: 50 }],
                    yearly: [{ tag: 'vintage', totalSales: 3100 }, { tag: 'denim', totalSales: 1800 }, { tag: 'hoodie', totalSales: 1400 }],
                };

                setAnalyticsData({
                    period,
                    salesData: mockSales[period],
                    topProducts: mockProducts[period],
                    topTags: mockTags[period]
                });
            } catch (err) {
                console.error("Error fetching analytics", err);
            } finally {
                setLoading(false);
            }
        };

        void fetchAnalytics();
    }, [period]);

    return (
        <SafeScreen>
            <View style={[styles.headerContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Shop Analytics</Text>
            </View>

            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.center}>
                        <LoadingIndicator message="Loading analytics..." />
                    </View>
                ) : analyticsData ? (
                    <AnalyticsDashboard
                        data={analyticsData}
                        onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
                    />
                ) : (
                    <View style={styles.center}>
                        <Text style={[styles.errorText, { color: theme.textSecondary }]}>No analytics data available.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        padding: 16,
        paddingTop: 24,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    errorText: {
        fontSize: 14,
    },
});
