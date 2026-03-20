import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ImageWithFallback } from './ui/image-with-fallback';
import { useTheme } from './ui/theme-provider';

// ─── PeriodSelector ─────────────────────────────────────────────────────────
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface PeriodSelectorProps {
    readonly currentPeriod: AnalyticsPeriod;
    readonly onSelectPeriod: (period: AnalyticsPeriod) => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ currentPeriod, onSelectPeriod }) => {
    const { theme } = useTheme();
    const periods: { label: string; value: AnalyticsPeriod }[] = [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
    ];

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={periodStyles.container}>
            {periods.map((p) => (
                <TouchableOpacity
                    key={p.value}
                    style={[periodStyles.button, { backgroundColor: currentPeriod === p.value ? theme.primary : theme.border }]}
                    onPress={() => onSelectPeriod(p.value)}
                    activeOpacity={0.7}
                >
                    <Text style={[periodStyles.text, { color: currentPeriod === p.value ? theme.white : theme.textSecondary }]}>
                        {p.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
};

const periodStyles = StyleSheet.create({
    container: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row' },
    button: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginRight: 8 },
    text: { fontSize: 14, fontWeight: '600' },
});

// ─── SalesLineChart ─────────────────────────────────────────────────────────
export interface SalesDataPoint {
    readonly label: string;
    readonly value: number;
}

export interface SalesLineChartProps {
    readonly data: readonly SalesDataPoint[];
    readonly title: string;
}

/**
 * A simple placeholder component for a line chart.
 * Since no charting library is installed, this will render simple vertical bars.
 */
export const SalesLineChart: React.FC<SalesLineChartProps> = ({ data, title }) => {
    const { theme } = useTheme();
    const maxValue = data.reduce((max, point) => (point.value > max ? point.value : max), 1);
    return (
        <View style={[chartStyles.container, { backgroundColor: theme.cardBackground }]}>
            <Text style={[chartStyles.title, { color: theme.textPrimary }]}>{title}</Text>
            {data.length === 0 ? (
                <Text style={[chartStyles.noData, { color: theme.textSecondary }]}>No data available for this period.</Text>
            ) : (
                <View style={chartStyles.chartArea}>
                    {data.map((point, index) => {
                        const heightPercent = `${(point.value / maxValue) * 100}%`;
                        return (
                            <View key={index} style={chartStyles.barContainer}>
                                <View style={[chartStyles.bar, { backgroundColor: theme.primary, height: heightPercent as `${number}%` }]} />
                                <Text style={[chartStyles.label, { color: theme.gray }]} numberOfLines={1}>{point.label}</Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
};

const chartStyles = StyleSheet.create({
    container: { marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 20 },
    title: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
    noData: { textAlign: 'center', fontStyle: 'italic', marginTop: 10 },
    chartArea: { height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 10 },
    barContainer: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
    bar: { width: 12, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 4 },
    label: { fontSize: 10, marginTop: 4 },
});

// ─── TopProductsList ────────────────────────────────────────────────────────
export interface TopProductItem {
    readonly id: number;
    readonly name: string;
    readonly imageUrl: string;
    readonly totalSales: number;
    readonly totalRevenue: number;
}

export interface TopProductsListProps {
    readonly products: readonly TopProductItem[];
}

export const TopProductsList: React.FC<TopProductsListProps> = ({ products }) => {
    const { theme } = useTheme();
    return (
        <View style={[listStyles.container, { backgroundColor: theme.cardBackground }]}>
            <Text style={[listStyles.title, { color: theme.textPrimary }]}>Top Selling Products</Text>
            {products.length === 0 ? (
                <Text style={[listStyles.noData, { color: theme.textSecondary }]}>No sales data available.</Text>
            ) : (
                products.map((product, index) => (
                    <View key={product.id} style={listStyles.itemContainer}>
                        <Text style={[listStyles.rank, { color: theme.gray }]}>#{index + 1}</Text>
                        <ImageWithFallback src={product.imageUrl} style={listStyles.image} />
                        <View style={listStyles.info}>
                            <Text style={[listStyles.name, { color: theme.textPrimary }]} numberOfLines={1}>{product.name}</Text>
                            <Text style={[listStyles.sales, { color: theme.textSecondary }]}>Sold: {product.totalSales}</Text>
                        </View>
                        <Text style={[listStyles.revenue, { color: theme.success }]}>₱{product.totalRevenue.toFixed(2)}</Text>
                    </View>
                ))
            )}
        </View>
    );
};

const listStyles = StyleSheet.create({
    container: { marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 20 },
    title: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
    noData: { textAlign: 'center', fontStyle: 'italic' },
    itemContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    rank: { fontSize: 14, fontWeight: 'bold', width: 24 },
    image: { width: 40, height: 40, borderRadius: 8, marginRight: 12 },
    info: { flex: 1 },
    name: { fontSize: 14, fontWeight: '500' },
    sales: { fontSize: 12 },
    revenue: { fontSize: 14, fontWeight: 'bold' },
});

// ─── TopTagsList ────────────────────────────────────────────────────────────
export interface TopTagItem {
    readonly tag: string;
    readonly totalSales: number;
}

export interface TopTagsListProps {
    readonly tags: readonly TopTagItem[];
}

export const TopTagsList: React.FC<TopTagsListProps> = ({ tags }) => {
    const { theme } = useTheme();
    return (
        <View style={[listStyles.container, { backgroundColor: theme.cardBackground }]}>
            <Text style={[listStyles.title, { color: theme.textPrimary }]}>Top Selling Tags</Text>
            {tags.length === 0 ? (
                <Text style={[listStyles.noData, { color: theme.textSecondary }]}>No tag data available.</Text>
            ) : (
                <View style={tagStyles.cloud}>
                    {tags.map((tagItem) => (
                        <View key={tagItem.tag} style={[tagStyles.chip, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <Text style={[tagStyles.chipText, { color: theme.textPrimary }]}>#{tagItem.tag}</Text>
                            <View style={[tagStyles.badge, { backgroundColor: theme.primary }]}>
                                <Text style={[tagStyles.badgeText, { color: theme.white }]}>{tagItem.totalSales}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const tagStyles = StyleSheet.create({
    cloud: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
    chipText: { fontSize: 13, marginRight: 6 },
    badge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 10, fontWeight: 'bold' },
});

// ─── AnalyticsDashboard ─────────────────────────────────────────────────────
export interface AnalyticsData {
    readonly period: AnalyticsPeriod;
    readonly salesData: readonly SalesDataPoint[];
    readonly topProducts: readonly TopProductItem[];
    readonly topTags: readonly TopTagItem[];
}

export interface AnalyticsDashboardProps {
    readonly data: AnalyticsData;
    readonly onPeriodChange: (period: AnalyticsPeriod) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ data, onPeriodChange }) => {
    return (
        <View style={dashboardStyles.container}>
            <PeriodSelector currentPeriod={data.period} onSelectPeriod={onPeriodChange} />
            <SalesLineChart data={data.salesData} title="Sales Revenue" />
            <TopProductsList products={data.topProducts} />
            <TopTagsList tags={data.topTags} />
        </View>
    );
};

const dashboardStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
