import { RipplePressable } from '@/components/ui/ripple-pressable';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { InteractionManager, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
    AddToCartTopProductsCard,
    AnalyticsScreenSkeleton,
    AnalyticsTotalsRow,
    GenderPieCard,
    SalesCalendarHeatmapCard,
    TopProductsCard,
    TrendChartCard,
} from '../../components/shop-analytics-components';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import {
    GenderAnalysisMode,
    TopProductsSortMode,
    getAnalyticsErrorMessage,
    useShopAnalyticsData,
} from '../../hooks/use-shop-analytics';

function normalizeShopUid(value: string | string[] | undefined): string | null {
    if (value === undefined) return null;

    const rawValue = Array.isArray(value) ? value[0] : value;
    const normalized = rawValue.trim();

    return normalized.length > 0 ? normalized : null;
}

function formatCurrency(value: number): string {
    return `₱${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function ShopAnalyticsScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { uid } = useLocalSearchParams<{ uid?: string | string[] }>();

    const shopUid = useMemo<string | null>(() => normalizeShopUid(uid), [uid]);
    const { data: analyticsData, isLoading, isError, error, refetch, isFetching } = useShopAnalyticsData(shopUid);

    const [topProductsSortMode, setTopProductsSortMode] = useState<TopProductsSortMode>('highest-sales');
    const [refundChartMode, setRefundChartMode] = useState<'line' | 'bar'>('line');
    const [genderAnalysisMode, setGenderAnalysisMode] = useState<GenderAnalysisMode>('purchases');

    const [selectedDailySalesDateKey, setSelectedDailySalesDateKey] = useState<string | null>(null);
    const [selectedRefundDateKey, setSelectedRefundDateKey] = useState<string | null>(null);
    const [selectedAddToCartDateKey, setSelectedAddToCartDateKey] = useState<string | null>(null);
    const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState<string | null>(null);
    const [isChartsReady, setIsChartsReady] = useState<boolean>(false);

    useEffect(() => {
        setIsChartsReady(false);

        const interactionTask = InteractionManager.runAfterInteractions(() => {
            setIsChartsReady(true);
        });

        return (): void => {
            interactionTask.cancel();
        };
    }, [shopUid]);

    useEffect(() => {
        if (analyticsData === null || analyticsData === undefined) return;

        const latestSalesPoint = analyticsData.dailySalesPoints[analyticsData.dailySalesPoints.length - 1];
        const latestRefundPoint = analyticsData.refundCountPoints[analyticsData.refundCountPoints.length - 1];
        const latestAddToCartPoint = analyticsData.addToCartCountPoints[analyticsData.addToCartCountPoints.length - 1];

        if (latestSalesPoint !== undefined) {
            setSelectedDailySalesDateKey((previousDateKey) => previousDateKey ?? latestSalesPoint.dateKey);
        }

        if (latestRefundPoint !== undefined) {
            setSelectedRefundDateKey((previousDateKey) => previousDateKey ?? latestRefundPoint.dateKey);
        }

        if (latestAddToCartPoint !== undefined) {
            setSelectedAddToCartDateKey((previousDateKey) => previousDateKey ?? latestAddToCartPoint.dateKey);
        }

        const todayKey = new Date().toISOString().slice(0, 10);
        const todayCell = analyticsData.saleCalendarCells.find((cell) => cell.dateKey === todayKey);
        const fallbackCell = analyticsData.saleCalendarCells.find((cell) => cell.isCurrentMonth && cell.dateKey !== null);
        const resolvedDateKey = todayCell?.dateKey ?? fallbackCell?.dateKey ?? null;

        if (resolvedDateKey !== null) {
            setSelectedCalendarDateKey((previousDateKey) => previousDateKey ?? resolvedDateKey);
        }
    }, [analyticsData]);

    const showContent = analyticsData !== null && analyticsData !== undefined;
    const analyticsErrorMessage = useMemo<string>(() => getAnalyticsErrorMessage(error), [error]);

    return (
        <SafeScreen style={styles.root}>
            <View style={[styles.headerContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <RipplePressable style={styles.headerBackButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
                </RipplePressable>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Shop Analytics</Text>
                <View style={styles.headerRightSpacer} />
            </View>

            <ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={isFetching}
                        onRefresh={() => {
                            void refetch();
                        }}
                        tintColor={theme.primary}
                    />
                }
            >
                {isLoading && <AnalyticsScreenSkeleton />}

                {!isLoading && shopUid === null && (
                    <EmptyList
                        icon={<MaterialIcons name="insights" size={48} color={theme.textSecondary} />}
                        message="Shop not found"
                        submessage="Missing shop identifier for analytics."
                    />
                )}

                {!isLoading && shopUid !== null && isError && (
                    <EmptyList
                        icon={<MaterialIcons name="error-outline" size={48} color={theme.textSecondary} />}
                        message="Unable to load analytics"
                        submessage={analyticsErrorMessage}
                        actionButton={{
                            label: 'Retry',
                            onPress: () => {
                                void refetch();
                            },
                        }}
                    />
                )}

                {!isLoading && shopUid !== null && !isError && !showContent && (
                    <EmptyList
                        icon={<MaterialIcons name="bar-chart" size={48} color={theme.textSecondary} />}
                        message="No analytics available"
                        submessage="Analytics will appear once orders are recorded."
                    />
                )}

                {showContent && analyticsData !== null && (
                    <View style={styles.analyticsContent}>
                        {!isChartsReady ? (
                            <AnalyticsScreenSkeleton />
                        ) : (
                            <>
                        <AnalyticsTotalsRow
                            totalSalesAmount={analyticsData.totals.totalSalesAmount}
                            totalOrders={analyticsData.totals.totalOrders}
                            totalRefunds={analyticsData.totals.totalRefunds}
                        />

                        <TrendChartCard
                            title="Daily Sales"
                            icon="show-chart"
                            points={analyticsData.dailySalesPoints}
                            mode="line"
                            selectedDateKey={selectedDailySalesDateKey}
                            onSelectDateKey={setSelectedDailySalesDateKey}
                            valueFormatter={formatCurrency}
                            emptyMessage="No sales data available yet."
                        />

                        <TrendChartCard
                            title="Add to Cart Count"
                            icon="add-shopping-cart"
                            points={analyticsData.addToCartCountPoints}
                            mode="line"
                            selectedDateKey={selectedAddToCartDateKey}
                            onSelectDateKey={setSelectedAddToCartDateKey}
                            valueFormatter={(value) => `${value.toLocaleString()} adds`}
                            emptyMessage="No add to cart activity yet."
                        />

                        <AddToCartTopProductsCard products={analyticsData.topProductsByAddToCart} />

                        <View style={styles.refundToggleRow}>
                            <Text style={[styles.refundToggleLabel, { color: theme.textSecondary }]}>Refund Graph</Text>
                            <View style={styles.refundToggleButtons}>
                                <RipplePressable
                                    style={[
                                        styles.refundToggleButton,
                                        {
                                            borderColor: refundChartMode === 'line' ? theme.primary : theme.border,
                                            backgroundColor: refundChartMode === 'line' ? `${theme.primary}20` : theme.cardBackground,
                                        },
                                    ]}
                                    onPress={() => setRefundChartMode('line')}
                                >
                                    <Text style={[styles.refundToggleButtonText, { color: refundChartMode === 'line' ? theme.primary : theme.textSecondary }]}>Line</Text>
                                </RipplePressable>

                                <RipplePressable
                                    style={[
                                        styles.refundToggleButton,
                                        {
                                            borderColor: refundChartMode === 'bar' ? theme.primary : theme.border,
                                            backgroundColor: refundChartMode === 'bar' ? `${theme.primary}20` : theme.cardBackground,
                                        },
                                    ]}
                                    onPress={() => setRefundChartMode('bar')}
                                >
                                    <Text style={[styles.refundToggleButtonText, { color: refundChartMode === 'bar' ? theme.primary : theme.textSecondary }]}>Bar</Text>
                                </RipplePressable>
                            </View>
                        </View>

                        <TrendChartCard
                            title="Refund Count"
                            icon="replay-circle-filled"
                            points={analyticsData.refundCountPoints}
                            mode={refundChartMode}
                            selectedDateKey={selectedRefundDateKey}
                            onSelectDateKey={setSelectedRefundDateKey}
                            valueFormatter={(value) => `${value.toLocaleString()} refunds`}
                            emptyMessage="No refund activity yet."
                        />

                        <TopProductsCard
                            sortMode={topProductsSortMode}
                            onSortModeChange={setTopProductsSortMode}
                            topProductsBySales={analyticsData.topProductsBySales}
                            topProductsBySoldCount={analyticsData.topProductsBySoldCount}
                            onViewAllPress={(mode) => {
                                router.push({
                                    pathname: '/home/shop-analytics-products' as const,
                                    params: {
                                        uid: analyticsData.shopUid,
                                        sort: mode,
                                    },
                                });
                            }}
                        />

                        <GenderPieCard
                            mode={genderAnalysisMode}
                            onModeChange={setGenderAnalysisMode}
                            purchaseSlices={analyticsData.purchaseGenderSlices}
                            refundSlices={analyticsData.refundGenderSlices}
                        />

                        <SalesCalendarHeatmapCard
                            cells={analyticsData.saleCalendarCells}
                            selectedDateKey={selectedCalendarDateKey}
                            onSelectDateKey={setSelectedCalendarDateKey}
                            valueFormatter={formatCurrency}
                        />
                            </>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 28,
    },
    analyticsContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerBackButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    headerRightSpacer: {
        width: 36,
        height: 36,
    },
    refundToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        marginTop: 4,
    },
    refundToggleLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    refundToggleButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    refundToggleButton: {
        borderWidth: 1,
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    refundToggleButtonText: {
        fontSize: 12,
        fontWeight: '700',
    },
});
