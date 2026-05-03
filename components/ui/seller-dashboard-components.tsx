import { RipplePressable } from '@/components/ui/ripple-pressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tables } from '../../supabase/database.types';
import { SkeletonLoader } from './skeleton-loader';
import { useTheme } from './theme-provider';

// ==========================================
// DashboardStatsWidget
// ==========================================
interface DashboardStatsWidgetProps {
    readonly totalSales: number;
    readonly totalOrders: number;
    readonly totalRefunds: number;
    readonly totalProducts: number;
    readonly isLoading?: boolean;
    readonly onViewPress?: () => void;
}

function formatCompactNumber(value: number): string {
    const absoluteValue = Math.abs(value);

    if (absoluteValue < 1000) {
        return Math.round(value).toLocaleString('en-US');
    }

    const compactUnits: ReadonlyArray<{ readonly threshold: number; readonly suffix: string }> = [
        { threshold: 1_000_000_000, suffix: 'B' },
        { threshold: 1_000_000, suffix: 'M' },
        { threshold: 1_000, suffix: 'k' },
    ];

    for (const unit of compactUnits) {
        if (absoluteValue >= unit.threshold) {
            const compactValue = value / unit.threshold;
            const formattedValue = Math.abs(compactValue) >= 100
                ? compactValue.toFixed(0)
                : compactValue.toFixed(1);

            return `${formattedValue.replace(/\.0$/, '')}${unit.suffix}`;
        }
    }

    return value.toLocaleString('en-US');
}

export function DashboardStatsWidget({ totalSales, totalOrders, totalRefunds, totalProducts, isLoading = false, onViewPress }: DashboardStatsWidgetProps): React.JSX.Element {
    const { theme } = useTheme();

    return (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Shop Analytics</Text>
                {isLoading ? (
                    <SkeletonLoader width={44} height={14} />
                ) : (
                    <RipplePressable onPress={onViewPress} disabled={onViewPress === undefined}>
                        <Text style={[styles.viewAllText, { color: onViewPress === undefined ? theme.textSecondary : theme.primary }]}>View</Text>
                    </RipplePressable>
                )}
            </View>
            <View style={styles.statsContainer}>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                    {isLoading ? (
                        <>
                            <SkeletonLoader height={18} width="72%" style={styles.statSkeletonTop} />
                            <SkeletonLoader height={12} width="58%" />
                        </>
                    ) : (
                        <>
                            <Text style={[styles.statValue, { color: theme.primary }]}>₱{formatCompactNumber(totalSales)}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Sales</Text>
                        </>
                    )}
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                    {isLoading ? (
                        <>
                            <SkeletonLoader height={18} width="52%" style={styles.statSkeletonTop} />
                            <SkeletonLoader height={12} width="50%" />
                        </>
                    ) : (
                        <>
                            <Text style={[styles.statValue, { color: theme.primary }]}>{formatCompactNumber(totalProducts)}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Products</Text>
                        </>
                    )}
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                    {isLoading ? (
                        <>
                            <SkeletonLoader height={18} width="52%" style={styles.statSkeletonTop} />
                            <SkeletonLoader height={12} width="58%" />
                        </>
                    ) : (
                        <>
                            <Text style={[styles.statValue, { color: theme.primary }]}>{formatCompactNumber(totalOrders)}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Orders</Text>
                        </>
                    )}
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.background }]}>
                    {isLoading ? (
                        <>
                            <SkeletonLoader height={18} width="52%" style={styles.statSkeletonTop} />
                            <SkeletonLoader height={12} width="56%" />
                        </>
                    ) : (
                        <>
                            <Text style={[styles.statValue, { color: theme.error }]}>{formatCompactNumber(totalRefunds)}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Refunds</Text>
                        </>
                    )}
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
    readonly isLoading?: boolean;
}

export function RecentOrdersWidget({ pendingCount, toShipCount, onManagePress, isLoading = false }: RecentOrdersWidgetProps): React.JSX.Element {
    const { theme } = useTheme();

    return (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Order Overview</Text>
                {isLoading ? (
                    <SkeletonLoader width={56} height={14} />
                ) : (
                    <RipplePressable onPress={onManagePress}>
                        <Text style={[styles.viewAllText, { color: theme.primary }]}>Manage</Text>
                    </RipplePressable>
                )}
            </View>

            <View style={styles.orderStatusContainer}>
                {isLoading ? (
                    <>
                        <View style={styles.orderStatusItem}>
                            <SkeletonLoader width={56} height={56} borderRadius={28} style={styles.orderIconSkeleton} />
                            <SkeletonLoader width={52} height={12} />
                        </View>
                        <View style={styles.orderStatusItem}>
                            <SkeletonLoader width={56} height={56} borderRadius={28} style={styles.orderIconSkeleton} />
                            <SkeletonLoader width={52} height={12} />
                        </View>
                    </>
                ) : (
                    <>
                        <RipplePressable style={styles.orderStatusItem} onPress={onManagePress}>
                            <View style={[styles.iconContainer, { backgroundColor: theme.warning + '20' }]}>
                                <Ionicons name="time-outline" size={24} color={theme.warning} />
                                {pendingCount > 0 && (
                                    <View style={[styles.badge, { backgroundColor: theme.error }]}>
                                        <Text style={styles.badgeText}>{pendingCount}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.orderStatusText, { color: theme.textPrimary }]}>Pending</Text>
                        </RipplePressable>

                        <RipplePressable style={styles.orderStatusItem} onPress={onManagePress}>
                            <View style={[styles.iconContainer, { backgroundColor: theme.info + '20' }]}>
                                <Ionicons name="cube-outline" size={24} color={theme.info} />
                                {toShipCount > 0 && (
                                    <View style={[styles.badge, { backgroundColor: theme.error }]}>
                                        <Text style={styles.badgeText}>{toShipCount}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.orderStatusText, { color: theme.textPrimary }]}>To Ship</Text>
                        </RipplePressable>
                    </>
                )}
            </View>
        </View>
    );
}

// ==========================================
// MyProductsWidget
// ==========================================
interface MyProductsWidgetProps {
    readonly products: Tables<'products'>[];
    readonly shopUid: string | null;
    readonly onUploadPress: () => void;
    readonly isLoading?: boolean;
}

export function MyProductsWidget({ products, shopUid, onUploadPress, isLoading = false }: MyProductsWidgetProps): React.JSX.Element {
    const { theme } = useTheme();
    const router = useRouter();

    return (
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>My Products</Text>
                {isLoading ? (
                    <SkeletonLoader width={94} height={14} />
                ) : (
                    <RipplePressable
                        onPress={() => {
                            if (shopUid === null) return;
                            router.push(`/home/shop-landing?uid=${shopUid}` as Parameters<typeof router.push>[0]);
                        }}
                        disabled={shopUid === null}
                    >
                        <Text style={[styles.viewAllText, { color: shopUid === null ? theme.textSecondary : theme.primary }]}>View My Store</Text>
                    </RipplePressable>
                )}
            </View>

            {isLoading ? (
                <View style={styles.productsLoadingWrap}>
                    <SkeletonLoader height={16} width="84%" style={styles.productsLoadingLine} />
                    <SkeletonLoader height={16} width="66%" />
                </View>
            ) : products.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="shirt-outline" size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>You haven&apos;t uploaded any products yet.</Text>
                </View>
            ) : (
                <View style={styles.productsSummary}>
                    <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
                        You have <Text style={{ fontWeight: 'bold' }}>{products.length}</Text> active product{products.length !== 1 ? 's' : ''}.
                    </Text>
                </View>
            )}

            <RipplePressable
                style={[styles.uploadButton, { backgroundColor: theme.primary }]}
                onPress={onUploadPress}
                activeOpacity={0.8}
            >
                <Ionicons name="add-circle-outline" size={20} color={theme.white} style={{ marginRight: 8 }} />
                <Text style={[styles.uploadButtonText, { color: theme.white }]}>Upload New Product</Text>
            </RipplePressable>
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
        flexWrap: 'wrap',
        rowGap: 8,
    },
    statBox: {
        width: '48%',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
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
    statSkeletonTop: {
        marginBottom: 6,
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
    orderIconSkeleton: {
        marginBottom: 8,
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
    productsLoadingWrap: {
        paddingVertical: 12,
        marginBottom: 8,
    },
    productsLoadingLine: {
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
