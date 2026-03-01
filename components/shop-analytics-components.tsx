import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { lightPalette } from '../utils/theme';
import { ImageWithFallback } from './ui/image-with-fallback';

// ─── PeriodSelector ─────────────────────────────────────────────────────────
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface PeriodSelectorProps {
    readonly currentPeriod: AnalyticsPeriod;
    readonly onSelectPeriod: (period: AnalyticsPeriod) => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ currentPeriod, onSelectPeriod }) => {
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
                    style={[
                        periodStyles.button,
                        currentPeriod === p.value && periodStyles.buttonActive
                    ]}
                    onPress={() => onSelectPeriod(p.value)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={[
                            periodStyles.text,
                            currentPeriod === p.value && periodStyles.textActive
                        ]}
                    >
                        {p.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
};

const periodStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
    },
    button: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#E9ECEF',
        marginRight: 8,
    },
    buttonActive: {
        backgroundColor: lightPalette.primary,
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
        color: '#525F7F',
    },
    textActive: {
        color: '#FFFFFF',
    },
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
    // Determine max value for relative scaling
    const maxValue = data.reduce((max, point) => (point.value > max ? point.value : max), 1);

    return (
        <View style={chartStyles.container}>
            <Text style={chartStyles.title}>{title}</Text>
            {data.length === 0 ? (
                <Text style={chartStyles.noData}>No data available for this period.</Text>
            ) : (
                <View style={chartStyles.chartArea}>
                    {data.map((point, index) => {
                        const heightPercent = `${(point.value / maxValue) * 100}%`;
                        return (
                            <View key={index} style={chartStyles.barContainer}>
                                <View style={[chartStyles.bar, { height: heightPercent as any }]} />
                                <Text style={chartStyles.label} numberOfLines={1}>{point.label}</Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
};

const chartStyles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
        marginBottom: 16,
    },
    noData: {
        textAlign: 'center',
        color: lightPalette.textSecondary,
        fontStyle: 'italic',
        marginTop: 10,
    },
    chartArea: {
        height: 150,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingTop: 10,
    },
    barContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
    },
    bar: {
        width: 12,
        backgroundColor: lightPalette.primary,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        minHeight: 4,
    },
    label: {
        fontSize: 10,
        color: '#ADB5BD',
        marginTop: 4,
    },
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
    return (
        <View style={listStyles.container}>
            <Text style={listStyles.title}>Top Selling Products</Text>
            {products.length === 0 ? (
                <Text style={listStyles.noData}>No sales data available.</Text>
            ) : (
                products.map((product, index) => (
                    <View key={product.id} style={listStyles.itemContainer}>
                        <Text style={listStyles.rank}>#{index + 1}</Text>
                        <ImageWithFallback src={product.imageUrl} style={listStyles.image} />
                        <View style={listStyles.info}>
                            <Text style={listStyles.name} numberOfLines={1}>{product.name}</Text>
                            <Text style={listStyles.sales}>Sold: {product.totalSales}</Text>
                        </View>
                        <Text style={listStyles.revenue}>₱{product.totalRevenue.toFixed(2)}</Text>
                    </View>
                ))
            )}
        </View>
    );
};

const listStyles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
        marginBottom: 16,
    },
    noData: {
        textAlign: 'center',
        color: lightPalette.textSecondary,
        fontStyle: 'italic',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    rank: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ADB5BD',
        width: 24,
    },
    image: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: 12,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 14,
        color: lightPalette.textPrimary,
        fontWeight: '500',
    },
    sales: {
        fontSize: 12,
        color: lightPalette.textSecondary,
    },
    revenue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: lightPalette.success,
    },
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
    return (
        <View style={listStyles.container}>
            <Text style={listStyles.title}>Top Selling Tags</Text>
            {tags.length === 0 ? (
                <Text style={listStyles.noData}>No tag data available.</Text>
            ) : (
                <View style={tagStyles.cloud}>
                    {tags.map((tagItem) => (
                        <View key={tagItem.tag} style={tagStyles.chip}>
                            <Text style={tagStyles.chipText}>#{tagItem.tag}</Text>
                            <View style={tagStyles.badge}>
                                <Text style={tagStyles.badgeText}>{tagItem.totalSales}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const tagStyles = StyleSheet.create({
    cloud: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#E9ECEF',
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginRight: 8,
        marginBottom: 8,
    },
    chipText: {
        color: lightPalette.textPrimary,
        fontSize: 13,
        marginRight: 6,
    },
    badge: {
        backgroundColor: lightPalette.primary,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
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
