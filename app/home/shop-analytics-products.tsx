import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { RipplePressable } from '@/components/ui/ripple-pressable';
import { EmptyList } from '../../components/ui/empty-list';
import { ImageWithFallback } from '../../components/ui/image-with-fallback';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { TopProductsSortMode, getAnalyticsErrorMessage, useShopAnalyticsData } from '../../hooks/use-shop-analytics';

interface ProductsAnalyticsRowItem {
    readonly rank: number;
    readonly uid: string;
    readonly name: string;
    readonly thumbnailUrl: string | null;
    readonly soldCount: number;
    readonly salesAmount: number;
}

function normalizeShopUid(value: string | string[] | undefined): string | null {
    if (value === undefined) return null;

    const rawValue = Array.isArray(value) ? value[0] : value;
    const normalized = rawValue.trim();

    return normalized.length > 0 ? normalized : null;
}

function normalizeSortMode(value: string | string[] | undefined): TopProductsSortMode {
    const rawValue = Array.isArray(value) ? value[0] : value;

    if (rawValue === 'highest-sold-count') {
        return 'highest-sold-count';
    }

    return 'highest-sales';
}

function formatCurrency(value: number): string {
    return `₱${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function buildRows(
    products: readonly {
        readonly productUid: string | null;
        readonly productName: string;
        readonly thumbnailUrl: string | null;
        readonly soldCount: number;
        readonly salesAmount: number;
    }[],
): ProductsAnalyticsRowItem[] {
    return products.map((product, index) => ({
        rank: index + 1,
        uid: product.productUid ?? `fallback-${index}`,
        name: product.productName,
        thumbnailUrl: product.thumbnailUrl,
        soldCount: product.soldCount,
        salesAmount: product.salesAmount,
    }));
}

/**
 * Full products analytics list screen for the selected sort mode.
 */
export default function ShopAnalyticsProductsScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { uid, sort } = useLocalSearchParams<{ uid?: string | string[]; sort?: string | string[] }>();

    const shopUid = useMemo<string | null>(() => normalizeShopUid(uid), [uid]);
    const [sortMode, setSortMode] = useState<TopProductsSortMode>(() => normalizeSortMode(sort));

    const { data: analyticsData, isLoading, isError, error, refetch } = useShopAnalyticsData(shopUid);
    const analyticsErrorMessage = useMemo<string>(() => getAnalyticsErrorMessage(error), [error]);

    const rows = useMemo<ProductsAnalyticsRowItem[]>(() => {
        if (analyticsData === null || analyticsData === undefined) {
            return [];
        }

        if (sortMode === 'highest-sold-count') {
            return buildRows(analyticsData.topProductsBySoldCount);
        }

        return buildRows(analyticsData.topProductsBySales);
    }, [analyticsData, sortMode]);

    return (
        <SafeScreen style={styles.root}>
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}> 
                <RipplePressable style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
                </RipplePressable>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Top Products</Text>
                <View style={styles.backButton} />
            </View>

            <View style={styles.content}>
                <View style={styles.segmentedControlRow}>
                    <RipplePressable
                        style={[
                            styles.segmentedControlButton,
                            {
                                borderColor: sortMode === 'highest-sales' ? theme.primary : theme.border,
                                backgroundColor: sortMode === 'highest-sales' ? `${theme.primary}20` : theme.cardBackground,
                            },
                        ]}
                        onPress={() => setSortMode('highest-sales')}
                    >
                        <Text style={[styles.segmentedControlText, { color: sortMode === 'highest-sales' ? theme.primary : theme.textSecondary }]}>Highest Sales</Text>
                    </RipplePressable>

                    <RipplePressable
                        style={[
                            styles.segmentedControlButton,
                            {
                                borderColor: sortMode === 'highest-sold-count' ? theme.primary : theme.border,
                                backgroundColor: sortMode === 'highest-sold-count' ? `${theme.primary}20` : theme.cardBackground,
                            },
                        ]}
                        onPress={() => setSortMode('highest-sold-count')}
                    >
                        <Text style={[styles.segmentedControlText, { color: sortMode === 'highest-sold-count' ? theme.primary : theme.textSecondary }]}>Highest Sold Count</Text>
                    </RipplePressable>
                </View>

                {isLoading && (
                    <View style={styles.skeletonWrap}>
                        {Array.from({ length: 8 }).map((_, index) => (
                            <View key={`skeleton-${index}`} style={[styles.row, { borderBottomColor: theme.border }]}> 
                                <SkeletonLoader width={24} height={14} />
                                <SkeletonLoader width={48} height={48} borderRadius={10} style={{ marginHorizontal: 10 }} />
                                <View style={styles.rowMeta}>
                                    <SkeletonLoader width="64%" height={14} style={{ marginBottom: 8 }} />
                                    <SkeletonLoader width="40%" height={12} />
                                </View>
                                <SkeletonLoader width={72} height={14} />
                            </View>
                        ))}
                    </View>
                )}

                {!isLoading && shopUid === null && (
                    <EmptyList
                        icon={<MaterialIcons name="insights" size={48} color={theme.textSecondary} />}
                        message="Shop not found"
                        submessage="Missing shop identifier for analytics products."
                    />
                )}

                {!isLoading && shopUid !== null && isError && (
                    <EmptyList
                        icon={<MaterialIcons name="error-outline" size={48} color={theme.textSecondary} />}
                        message="Unable to load products"
                        submessage={analyticsErrorMessage}
                        actionButton={{
                            label: 'Retry',
                            onPress: () => {
                                void refetch();
                            },
                        }}
                    />
                )}

                {!isLoading && !isError && shopUid !== null && rows.length === 0 && (
                    <EmptyList
                        icon={<MaterialIcons name="inventory-2" size={48} color={theme.textSecondary} />}
                        message="No product analytics yet"
                        submessage="Products will appear here once sales data is available."
                    />
                )}

                {!isLoading && !isError && shopUid !== null && rows.length > 0 && (
                    <FlatList
                        data={rows}
                        keyExtractor={(item) => `${item.uid}-${item.rank}`}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <View style={[styles.row, { borderBottomColor: theme.border }]}> 
                                <Text style={[styles.rank, { color: theme.textSecondary }]}>#{item.rank}</Text>

                                <ImageWithFallback
                                    uri={item.thumbnailUrl}
                                    style={[styles.thumbnail, { borderColor: theme.border }]}
                                />

                                <View style={styles.rowMeta}>
                                    <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                    <Text style={[styles.subtext, { color: theme.textSecondary }]}> 
                                        {item.soldCount.toLocaleString()} sold
                                    </Text>
                                </View>

                                <Text style={[styles.metric, { color: sortMode === 'highest-sales' ? theme.primary : theme.textPrimary }]}> 
                                    {sortMode === 'highest-sales'
                                        ? formatCurrency(item.salesAmount)
                                        : `${item.soldCount.toLocaleString()} sold`}
                                </Text>
                            </View>
                        )}
                    />
                )}
            </View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 14,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
    },
    segmentedControlRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    segmentedControlButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    segmentedControlText: {
        fontSize: 12,
        fontWeight: '700',
    },
    listContent: {
        paddingBottom: 28,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingVertical: 10,
    },
    rank: {
        width: 28,
        fontSize: 12,
        fontWeight: '700',
    },
    thumbnail: {
        width: 48,
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        marginRight: 10,
        overflow: 'hidden',
    },
    rowMeta: {
        flex: 1,
        marginRight: 10,
    },
    name: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    subtext: {
        fontSize: 11,
    },
    metric: {
        fontSize: 12,
        fontWeight: '700',
    },
    skeletonWrap: {
        marginTop: 4,
    },
});
