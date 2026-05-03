import { RipplePressable } from '@/components/ui/ripple-pressable';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import type {
    AddToCartProductAnalytics,
    AnalyticsPoint,
    CalendarHeatmapCell,
    GenderAnalysisMode,
    GenderAnalyticsSlice,
    TopProductAnalytics,
    TopProductsSortMode,
} from '../hooks/use-shop-analytics';
import { ImageWithFallback } from './ui/image-with-fallback';
import { SkeletonLoader } from './ui/skeleton-loader';
import { useTheme } from './ui/theme-provider';

const TREND_DRAW_HEIGHT = 130;
const TREND_SVG_HEIGHT = 150;
const TREND_LABEL_GAP = 8;
const TREND_INSET_X = 14;
const PIE_CHART_SIZE = 170;
const TOP_PRODUCTS_PREVIEW_COUNT = 5;
const WEEKDAY_LABELS: readonly string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface TrendPointGeometry {
    readonly dateKey: string;
    readonly label: string;
    readonly value: number;
    readonly x: number;
    readonly y: number;
}

interface PieSliceGeometry {
    readonly key: string;
    readonly value: number;
    readonly color: string;
    readonly startAngle: number;
    readonly endAngle: number;
}

interface AnalyticsTotalsRowProps {
    readonly totalSalesAmount: number;
    readonly totalOrders: number;
    readonly totalRefunds: number;
    readonly isLoading?: boolean;
}

interface TrendChartCardProps {
    readonly title: string;
    readonly icon: keyof typeof MaterialIcons.glyphMap;
    readonly points: readonly AnalyticsPoint[];
    readonly mode: 'line' | 'bar';
    readonly selectedDateKey: string | null;
    readonly onSelectDateKey: (dateKey: string) => void;
    readonly valueFormatter: (value: number) => string;
    readonly emptyMessage: string;
}

interface TopProductsCardProps {
    readonly sortMode: TopProductsSortMode;
    readonly onSortModeChange: (mode: TopProductsSortMode) => void;
    readonly topProductsBySales: readonly TopProductAnalytics[];
    readonly topProductsBySoldCount: readonly TopProductAnalytics[];
    readonly onViewAllPress: (mode: TopProductsSortMode) => void;
}

interface AddToCartTopProductsCardProps {
    readonly products: readonly AddToCartProductAnalytics[];
}

interface GenderPieCardProps {
    readonly mode: GenderAnalysisMode;
    readonly onModeChange: (mode: GenderAnalysisMode) => void;
    readonly purchaseSlices: readonly GenderAnalyticsSlice[];
    readonly refundSlices: readonly GenderAnalyticsSlice[];
}

interface SalesCalendarHeatmapCardProps {
    readonly cells: readonly CalendarHeatmapCell[];
    readonly selectedDateKey: string | null;
    readonly onSelectDateKey: (dateKey: string) => void;
    readonly valueFormatter: (value: number) => string;
}

function formatCurrency(value: number): string {
    return `PHP ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function parseHexToRgb(hexColor: string): { readonly red: number; readonly green: number; readonly blue: number } {
    const normalized = hexColor.replace('#', '');

    if (normalized.length !== 6) {
        return {
            red: 45,
            green: 206,
            blue: 137,
        };
    }

    return {
        red: Number.parseInt(normalized.slice(0, 2), 16),
        green: Number.parseInt(normalized.slice(2, 4), 16),
        blue: Number.parseInt(normalized.slice(4, 6), 16),
    };
}

function resolveHeatColor(intensity: number, successHexColor: string): string {
    if (intensity <= 0) {
        return 'transparent';
    }

    const bounded = Math.max(0, Math.min(1, intensity));
    const successColor = parseHexToRgb(successHexColor);
    const whiteMixRatio = 0.82 - (bounded * 0.7);

    const mixedRed = Math.round((255 * whiteMixRatio) + (successColor.red * (1 - whiteMixRatio)));
    const mixedGreen = Math.round((255 * whiteMixRatio) + (successColor.green * (1 - whiteMixRatio)));
    const mixedBlue = Math.round((255 * whiteMixRatio) + (successColor.blue * (1 - whiteMixRatio)));

    return `rgb(${mixedRed}, ${mixedGreen}, ${mixedBlue})`;
}

function toPieSlicePath(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
): string {
    const startX = centerX + radius * Math.cos(startAngle);
    const startY = centerY + radius * Math.sin(startAngle);
    const endX = centerX + radius * Math.cos(endAngle);
    const endY = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
}

function resolvePieColors(themePrimary: string, themeInfo: string, themeWarning: string, themeSuccess: string, themeError: string): readonly string[] {
    return [themePrimary, themeInfo, themeWarning, themeSuccess, themeError];
}

function resolvePointGeometry(points: readonly AnalyticsPoint[], width: number): TrendPointGeometry[] {
    if (points.length === 0 || width <= 0) return [];

    const maxValue = Math.max(1, ...points.map((point) => point.value));
    const drawableWidth = Math.max(1, width - (TREND_INSET_X * 2));
    const xStep = points.length === 1 ? 0 : drawableWidth / (points.length - 1);

    return points.map((point, index) => {
        const normalized = point.value / maxValue;
        const x = TREND_INSET_X + (xStep * index);
        const y = 10 + ((1 - normalized) * TREND_DRAW_HEIGHT);

        return {
            dateKey: point.dateKey,
            label: point.label,
            value: point.value,
            x,
            y,
        };
    });
}

function resolveSelectedPoint(points: readonly AnalyticsPoint[], selectedDateKey: string | null): AnalyticsPoint | null {
    if (points.length === 0) return null;

    if (selectedDateKey !== null) {
        const selectedPoint = points.find((point) => point.dateKey === selectedDateKey);
        if (selectedPoint !== undefined) return selectedPoint;
    }

    return points[points.length - 1];
}

function resolveDateLabel(dateLabel: string): string {
    const segments = dateLabel.split(' ');

    if (segments.length >= 2) {
        return segments[1];
    }

    return dateLabel;
}

/**
 * Displays high-level summary metrics for the analytics dashboard.
 */
export function AnalyticsTotalsRow({
    totalSalesAmount,
    totalOrders,
    totalRefunds,
    isLoading = false,
}: AnalyticsTotalsRowProps): React.JSX.Element {
    const { theme } = useTheme();

    return (
        <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Sales</Text>
                {isLoading ? (
                    <SkeletonLoader width="70%" height={18} />
                ) : (
                    <Text style={[styles.summaryValue, { color: theme.primary }]}>{formatCurrency(totalSalesAmount)}</Text>
                )}
            </View>

            <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Orders</Text>
                {isLoading ? (
                    <SkeletonLoader width="45%" height={18} />
                ) : (
                    <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{totalOrders}</Text>
                )}
            </View>

            <View style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Refunds</Text>
                {isLoading ? (
                    <SkeletonLoader width="48%" height={18} />
                ) : (
                    <Text style={[styles.summaryValue, { color: theme.error }]}>{totalRefunds}</Text>
                )}
            </View>
        </View>
    );
}

/**
 * Reusable interactive trend chart card that supports line and bar modes.
 */
export function TrendChartCard({
    title,
    icon,
    points,
    mode,
    selectedDateKey,
    onSelectDateKey,
    valueFormatter,
    emptyMessage,
}: TrendChartCardProps): React.JSX.Element {
    const { theme } = useTheme();
    const [chartWidth, setChartWidth] = useState<number>(0);

    const selectedPoint = useMemo<AnalyticsPoint | null>(() => resolveSelectedPoint(points, selectedDateKey), [points, selectedDateKey]);
    const pointGeometry = useMemo<TrendPointGeometry[]>(() => resolvePointGeometry(points, chartWidth), [points, chartWidth]);

    const linePoints = useMemo<string>(() => pointGeometry.map((point) => `${point.x},${point.y}`).join(' '), [pointGeometry]);

    const maxValue = useMemo<number>(() => {
        if (points.length === 0) return 1;

        return Math.max(1, ...points.map((point) => point.value));
    }, [points]);

    const labelStride = points.length > 8 ? 2 : 1;

    const handleLayout = (event: LayoutChangeEvent): void => {
        const nextWidth = event.nativeEvent.layout.width;
        setChartWidth(nextWidth);
    };

    return (
        <View style={[styles.analyticsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
            <View style={styles.analyticsCardHeader}>
                <View style={styles.analyticsCardTitleRow}>
                    <MaterialIcons name={icon} size={18} color={theme.primary} />
                    <Text style={[styles.analyticsCardTitle, { color: theme.textPrimary }]}>{title}</Text>
                </View>
            </View>

            {points.length === 0 ? (
                <View style={styles.emptyChartState}>
                    <MaterialIcons name="insert-chart-outlined" size={34} color={theme.textSecondary} />
                    <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>{emptyMessage}</Text>
                </View>
            ) : (
                <>
                    <View style={styles.chartSurface} onLayout={handleLayout}>
                        <Svg width={chartWidth} height={TREND_SVG_HEIGHT}>
                            {mode === 'line' ? (
                                <>
                                    <Polyline
                                        points={linePoints}
                                        fill="none"
                                        stroke={theme.primary}
                                        strokeWidth={2}
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                    />

                                    {pointGeometry.map((point) => {
                                        const isSelected = selectedPoint?.dateKey === point.dateKey;

                                        return (
                                            <Circle
                                                key={`point-${point.dateKey}`}
                                                cx={point.x}
                                                cy={point.y}
                                                r={isSelected ? 5 : 4}
                                                fill={isSelected ? theme.primary : theme.cardBackground}
                                                stroke={theme.primary}
                                                strokeWidth={2}
                                                onPress={() => onSelectDateKey(point.dateKey)}
                                            />
                                        );
                                    })}
                                </>
                            ) : (
                                pointGeometry.map((point) => {
                                    const barBottom = TREND_DRAW_HEIGHT + 10;
                                    const barWidth = Math.max(8, (chartWidth - 24) / (pointGeometry.length * 1.7));
                                    const barHeight = barBottom - point.y;
                                    const isSelected = selectedPoint?.dateKey === point.dateKey;

                                    return (
                                        <Rect
                                            key={`bar-${point.dateKey}`}
                                            x={point.x - (barWidth / 2)}
                                            y={point.y}
                                            width={barWidth}
                                            height={Math.max(2, barHeight)}
                                            fill={isSelected ? theme.primary : `${theme.primary}70`}
                                            rx={4}
                                            onPress={() => onSelectDateKey(point.dateKey)}
                                        />
                                    );
                                })
                            )}
                        </Svg>
                    </View>

                    <View style={[styles.axisLabelRow, { marginTop: TREND_LABEL_GAP }]}> 
                        {points.map((point, index) => (
                            <Text
                                key={`label-${point.dateKey}`}
                                style={[
                                    styles.axisLabel,
                                    { color: theme.textSecondary, opacity: index % labelStride === 0 ? 1 : 0.15 },
                                ]}
                                numberOfLines={1}
                            >
                                {resolveDateLabel(point.label)}
                            </Text>
                        ))}
                    </View>

                    <View style={[styles.selectedInfoCard, { backgroundColor: theme.background, borderColor: theme.border }]}> 
                        <Text style={[styles.selectedInfoDate, { color: theme.textSecondary }]}>
                            {selectedPoint?.label}
                        </Text>
                        <Text style={[styles.selectedInfoValue, { color: theme.textPrimary }]}>
                            {valueFormatter(selectedPoint?.value ?? 0)}
                        </Text>
                        <Text style={[styles.selectedInfoSubtext, { color: theme.textSecondary }]}>
                            Peak in range: {valueFormatter(maxValue)}
                        </Text>
                    </View>
                </>
            )}
        </View>
    );
}

/**
 * Displays the top product rankings with sorting mode toggle and View All action.
 */
export function TopProductsCard({
    sortMode,
    onSortModeChange,
    topProductsBySales,
    topProductsBySoldCount,
    onViewAllPress,
}: TopProductsCardProps): React.JSX.Element {
    const { theme } = useTheme();

    const activeProducts = sortMode === 'highest-sales' ? topProductsBySales : topProductsBySoldCount;
    const topFiveProducts = activeProducts.slice(0, 5);

    return (
        <View style={[styles.analyticsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
            <View style={styles.analyticsCardHeader}>
                <View style={styles.analyticsCardTitleRow}>
                    <MaterialIcons name="workspace-premium" size={18} color={theme.primary} />
                    <Text style={[styles.analyticsCardTitle, { color: theme.textPrimary }]}>Top Five Products</Text>
                </View>
                <RipplePressable onPress={() => onViewAllPress(sortMode)}>
                    <Text style={[styles.analyticsCardAction, { color: theme.primary }]}>View All</Text>
                </RipplePressable>
            </View>

            <View style={styles.segmentedControlRow}>
                <RipplePressable
                    style={[
                        styles.segmentedControlButton,
                        {
                            backgroundColor: sortMode === 'highest-sales' ? `${theme.primary}20` : theme.background,
                            borderColor: sortMode === 'highest-sales' ? theme.primary : theme.border,
                        },
                    ]}
                    onPress={() => onSortModeChange('highest-sales')}
                >
                    <Text
                        style={[
                            styles.segmentedControlText,
                            { color: sortMode === 'highest-sales' ? theme.primary : theme.textSecondary },
                        ]}
                    >
                        Highest Sales
                    </Text>
                </RipplePressable>

                <RipplePressable
                    style={[
                        styles.segmentedControlButton,
                        {
                            backgroundColor: sortMode === 'highest-sold-count' ? `${theme.primary}20` : theme.background,
                            borderColor: sortMode === 'highest-sold-count' ? theme.primary : theme.border,
                        },
                    ]}
                    onPress={() => onSortModeChange('highest-sold-count')}
                >
                    <Text
                        style={[
                            styles.segmentedControlText,
                            { color: sortMode === 'highest-sold-count' ? theme.primary : theme.textSecondary },
                        ]}
                    >
                        Highest Sold Count
                    </Text>
                </RipplePressable>
            </View>

            {topFiveProducts.length === 0 ? (
                <View style={styles.emptyChartState}>
                    <MaterialIcons name="inventory-2" size={34} color={theme.textSecondary} />
                    <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>No product sales yet.</Text>
                </View>
            ) : (
                <View style={styles.topProductsList}>
                    {topFiveProducts.map((product, index) => (
                        <View key={`${product.productId ?? product.productName}-${index}`} style={[styles.topProductItem, { borderBottomColor: theme.border }]}> 
                            <Text style={[styles.topProductRank, { color: theme.textSecondary }]}>#{index + 1}</Text>

                            <ImageWithFallback
                                uri={product.thumbnailUrl}
                                style={[styles.topProductImage, { borderColor: theme.border }]}
                            />

                            <View style={styles.topProductMeta}>
                                <Text style={[styles.topProductName, { color: theme.textPrimary }]} numberOfLines={1}>
                                    {product.productName}
                                </Text>
                                <Text style={[styles.topProductSubtext, { color: theme.textSecondary }]}>
                                    {product.soldCount.toLocaleString()} sold
                                </Text>
                            </View>

                            <Text style={[styles.topProductMetric, { color: theme.primary }]}>
                                {sortMode === 'highest-sales'
                                    ? formatCurrency(product.salesAmount)
                                    : `${product.soldCount.toLocaleString()} sold`}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

/**
 * Displays top add-to-cart products with sort controls and a View All toggle.
 */
export function AddToCartTopProductsCard({
    products,
}: AddToCartTopProductsCardProps): React.JSX.Element {
    const { theme } = useTheme();

    const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');
    const [isViewAllVisible, setIsViewAllVisible] = useState<boolean>(false);

    const sortedProducts = useMemo<AddToCartProductAnalytics[]>(() => {
        return [...products].sort((a, b) => {
            if (sortDirection === 'descending') {
                if (b.addToCartCount === a.addToCartCount) {
                    return a.productName.localeCompare(b.productName);
                }

                return b.addToCartCount - a.addToCartCount;
            }

            if (a.addToCartCount === b.addToCartCount) {
                return a.productName.localeCompare(b.productName);
            }

            return a.addToCartCount - b.addToCartCount;
        });
    }, [products, sortDirection]);

    const canViewAll = sortedProducts.length > TOP_PRODUCTS_PREVIEW_COUNT;
    const visibleProducts = isViewAllVisible ? sortedProducts : sortedProducts.slice(0, TOP_PRODUCTS_PREVIEW_COUNT);

    return (
        <View style={[styles.analyticsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
            <View style={styles.analyticsCardHeader}>
                <View style={styles.analyticsCardTitleRow}>
                    <MaterialIcons name="add-shopping-cart" size={18} color={theme.primary} />
                    <Text style={[styles.analyticsCardTitle, { color: theme.textPrimary }]}>Top Add to Cart Products</Text>
                </View>
                {canViewAll && (
                    <RipplePressable onPress={() => setIsViewAllVisible((current) => !current)}>
                        <Text style={[styles.analyticsCardAction, { color: theme.primary }]}>
                            {isViewAllVisible ? 'Show Less' : 'View All'}
                        </Text>
                    </RipplePressable>
                )}
            </View>

            <View style={styles.segmentedControlRow}>
                <RipplePressable
                    style={[
                        styles.segmentedControlButton,
                        {
                            backgroundColor: sortDirection === 'descending' ? `${theme.primary}20` : theme.background,
                            borderColor: sortDirection === 'descending' ? theme.primary : theme.border,
                        },
                    ]}
                    onPress={() => setSortDirection('descending')}
                >
                    <Text
                        style={[
                            styles.segmentedControlText,
                            { color: sortDirection === 'descending' ? theme.primary : theme.textSecondary },
                        ]}
                    >
                        Descending
                    </Text>
                </RipplePressable>

                <RipplePressable
                    style={[
                        styles.segmentedControlButton,
                        {
                            backgroundColor: sortDirection === 'ascending' ? `${theme.primary}20` : theme.background,
                            borderColor: sortDirection === 'ascending' ? theme.primary : theme.border,
                        },
                    ]}
                    onPress={() => setSortDirection('ascending')}
                >
                    <Text
                        style={[
                            styles.segmentedControlText,
                            { color: sortDirection === 'ascending' ? theme.primary : theme.textSecondary },
                        ]}
                    >
                        Ascending
                    </Text>
                </RipplePressable>
            </View>

            {visibleProducts.length === 0 ? (
                <View style={styles.emptyChartState}>
                    <MaterialIcons name="add-shopping-cart" size={34} color={theme.textSecondary} />
                    <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>No add to cart activity yet.</Text>
                </View>
            ) : (
                <View style={styles.topProductsList}>
                    {visibleProducts.map((product, index) => (
                        <View key={`${product.productId}-${index}`} style={[styles.topProductItem, { borderBottomColor: theme.border }]}> 
                            <Text style={[styles.topProductRank, { color: theme.textSecondary }]}>#{index + 1}</Text>

                            <ImageWithFallback
                                uri={product.thumbnailUrl}
                                style={[styles.topProductImage, { borderColor: theme.border }]}
                            />

                            <View style={styles.topProductMeta}>
                                <Text style={[styles.topProductName, { color: theme.textPrimary }]} numberOfLines={1}>
                                    {product.productName}
                                </Text>
                                <Text style={[styles.topProductSubtext, { color: theme.textSecondary }]}>
                                    {product.addToCartCount.toLocaleString()} add to cart
                                </Text>
                            </View>

                            <Text style={[styles.topProductMetric, { color: theme.primary }]}>
                                {product.addToCartCount.toLocaleString()} adds
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

/**
 * Displays a pie chart of gender distribution for purchases or refunds.
 */
export function GenderPieCard({
    mode,
    onModeChange,
    purchaseSlices,
    refundSlices,
}: GenderPieCardProps): React.JSX.Element {
    const { theme } = useTheme();

    const slices = mode === 'purchases' ? purchaseSlices : refundSlices;
    const total = slices.reduce((runningTotal, slice) => runningTotal + slice.value, 0);

    const palette = resolvePieColors(theme.primary, theme.info, theme.warning, theme.success, theme.error);

    const geometry = useMemo<PieSliceGeometry[]>(() => {
        if (total <= 0) return [];

        let startAngle = -Math.PI / 2;

        return slices.map((slice, index) => {
            const percentage = slice.value / total;
            const endAngle = startAngle + (percentage * Math.PI * 2);
            const next = {
                key: slice.key,
                value: slice.value,
                color: palette[index % palette.length],
                startAngle,
                endAngle,
            };

            startAngle = endAngle;
            return next;
        });
    }, [palette, slices, total]);

    return (
        <View style={[styles.analyticsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
            <View style={styles.analyticsCardHeader}>
                <View style={styles.analyticsCardTitleRow}>
                    <MaterialIcons name="pie-chart" size={18} color={theme.primary} />
                    <Text style={[styles.analyticsCardTitle, { color: theme.textPrimary }]}>Gender Analysis</Text>
                </View>
            </View>

            <View style={styles.segmentedControlRow}>
                <RipplePressable
                    style={[
                        styles.segmentedControlButton,
                        {
                            backgroundColor: mode === 'purchases' ? `${theme.primary}20` : theme.background,
                            borderColor: mode === 'purchases' ? theme.primary : theme.border,
                        },
                    ]}
                    onPress={() => onModeChange('purchases')}
                >
                    <Text style={[styles.segmentedControlText, { color: mode === 'purchases' ? theme.primary : theme.textSecondary }]}>Purchases</Text>
                </RipplePressable>

                <RipplePressable
                    style={[
                        styles.segmentedControlButton,
                        {
                            backgroundColor: mode === 'refunds' ? `${theme.primary}20` : theme.background,
                            borderColor: mode === 'refunds' ? theme.primary : theme.border,
                        },
                    ]}
                    onPress={() => onModeChange('refunds')}
                >
                    <Text style={[styles.segmentedControlText, { color: mode === 'refunds' ? theme.primary : theme.textSecondary }]}>Refunds</Text>
                </RipplePressable>
            </View>

            {total <= 0 ? (
                <View style={styles.emptyChartState}>
                    <MaterialIcons name="donut-large" size={34} color={theme.textSecondary} />
                    <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>No gender data yet.</Text>
                </View>
            ) : (
                <View style={styles.pieLayout}>
                    <Svg width={PIE_CHART_SIZE} height={PIE_CHART_SIZE}>
                        {geometry.map((slice) => (
                            <Path
                                key={slice.key}
                                d={toPieSlicePath(PIE_CHART_SIZE / 2, PIE_CHART_SIZE / 2, PIE_CHART_SIZE / 2 - 8, slice.startAngle, slice.endAngle)}
                                fill={slice.color}
                            />
                        ))}
                        <Circle
                            cx={PIE_CHART_SIZE / 2}
                            cy={PIE_CHART_SIZE / 2}
                            r={PIE_CHART_SIZE * 0.23}
                            fill={theme.cardBackground}
                        />
                    </Svg>

                    <View style={styles.pieLegendWrap}>
                        {slices.map((slice, index) => {
                            const color = palette[index % palette.length];
                            const percentage = total <= 0 ? 0 : (slice.value / total) * 100;

                            return (
                                <View key={slice.key} style={styles.pieLegendItem}>
                                    <View style={[styles.pieLegendDot, { backgroundColor: color }]} />
                                    <View style={styles.pieLegendTextWrap}>
                                        <Text style={[styles.pieLegendLabel, { color: theme.textPrimary }]}>{slice.label}</Text>
                                        <Text style={[styles.pieLegendValue, { color: theme.textSecondary }]}>
                                            {slice.value.toLocaleString()} ({percentage.toFixed(1)}%)
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}
        </View>
    );
}

/**
 * Displays monthly sales in a calendar heatmap where each date cell is selectable.
 */
export function SalesCalendarHeatmapCard({
    cells,
    selectedDateKey,
    onSelectDateKey,
    valueFormatter,
}: SalesCalendarHeatmapCardProps): React.JSX.Element {
    const { theme } = useTheme();

    const selectedCell = useMemo<CalendarHeatmapCell | null>(() => {
        if (selectedDateKey === null) return null;

        const found = cells.find((cell) => cell.dateKey === selectedDateKey);
        return found ?? null;
    }, [cells, selectedDateKey]);

    return (
        <View style={[styles.analyticsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
            <View style={styles.analyticsCardHeader}>
                <View style={styles.analyticsCardTitleRow}>
                    <MaterialIcons name="calendar-month" size={18} color={theme.primary} />
                    <Text style={[styles.analyticsCardTitle, { color: theme.textPrimary }]}>Sale Amount Calendar</Text>
                </View>
            </View>

            <View style={styles.calendarLegendRow}>
                <Text style={[styles.calendarLegendText, { color: theme.textSecondary }]}>Low</Text>
                <View style={styles.calendarLegendScale}>
                    <View style={[styles.calendarLegendSwatch, { backgroundColor: resolveHeatColor(0.2, theme.success), borderColor: theme.border }]} />
                    <View style={[styles.calendarLegendSwatch, { backgroundColor: resolveHeatColor(0.5, theme.success), borderColor: theme.border }]} />
                    <View style={[styles.calendarLegendSwatch, { backgroundColor: resolveHeatColor(0.85, theme.success), borderColor: theme.border }]} />
                </View>
                <Text style={[styles.calendarLegendText, { color: theme.textSecondary }]}>High</Text>
            </View>

            <View style={styles.calendarWeekdayRow}>
                {WEEKDAY_LABELS.map((weekday) => (
                    <Text key={weekday} style={[styles.calendarWeekday, { color: theme.textSecondary }]}>
                        {weekday}
                    </Text>
                ))}
            </View>

            <View style={styles.calendarGrid}>
                {cells.map((cell) => {
                    const isSelectable = cell.isCurrentMonth && cell.dateKey !== null;
                    const isSelected = isSelectable && cell.dateKey === selectedDateKey;
                    const backgroundColor = cell.isCurrentMonth
                        ? resolveHeatColor(cell.intensity, theme.success)
                        : 'transparent';

                    return (
                        <RipplePressable
                            key={cell.key}
                            style={[
                                styles.calendarCell,
                                {
                                    backgroundColor,
                                    borderColor: isSelected ? theme.primary : theme.border,
                                    opacity: cell.isCurrentMonth ? 1 : 0,
                                },
                            ]}
                            disabled={!isSelectable}
                            onPress={() => {
                                if (cell.dateKey !== null) {
                                    onSelectDateKey(cell.dateKey);
                                }
                            }}
                        >
                            {cell.dayNumber !== null && (
                                <Text
                                    style={[
                                        styles.calendarCellDay,
                                        { color: theme.textPrimary },
                                        cell.isToday && { color: theme.primary, fontWeight: '800' },
                                    ]}
                                >
                                    {cell.dayNumber}
                                </Text>
                            )}
                        </RipplePressable>
                    );
                })}
            </View>

            <View style={[styles.selectedInfoCard, { backgroundColor: theme.background, borderColor: theme.border }]}> 
                <Text style={[styles.selectedInfoDate, { color: theme.textSecondary }]}>Selected Day</Text>
                <Text style={[styles.selectedInfoValue, { color: theme.textPrimary }]}>
                    {selectedCell?.dateKey ?? 'Select a date'}
                </Text>
                <Text style={[styles.selectedInfoSubtext, { color: theme.textSecondary }]}> 
                    {selectedCell === null
                        ? 'Tap a date to see daily sale amount.'
                        : valueFormatter(selectedCell.saleAmount)}
                </Text>
            </View>
        </View>
    );
}

/**
 * Full-screen skeleton layout used while analytics data is loading.
 */
export function AnalyticsScreenSkeleton(): React.JSX.Element {
    const { theme } = useTheme();

    return (
        <View style={styles.skeletonContainer}>
            <View style={styles.summaryRow}>
                {Array.from({ length: 3 }).map((_, index) => (
                    <View key={`summary-${index}`} style={[styles.summaryCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                        <SkeletonLoader height={12} width="65%" style={{ marginBottom: 8 }} />
                        <SkeletonLoader height={20} width="55%" />
                    </View>
                ))}
            </View>

            {Array.from({ length: 4 }).map((_, index) => (
                <View key={`card-${index}`} style={[styles.analyticsCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                    <SkeletonLoader height={16} width="40%" style={{ marginBottom: 16 }} />
                    <SkeletonLoader height={140} width="100%" />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    skeletonContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14,
    },
    summaryCard: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 6,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '800',
    },
    analyticsCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        marginBottom: 14,
    },
    analyticsCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    analyticsCardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    analyticsCardTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    analyticsCardAction: {
        fontSize: 13,
        fontWeight: '700',
    },
    chartSurface: {
        width: '100%',
        height: TREND_SVG_HEIGHT,
    },
    axisLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    axisLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        fontWeight: '600',
    },
    selectedInfoCard: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 12,
    },
    selectedInfoDate: {
        fontSize: 12,
        marginBottom: 4,
    },
    selectedInfoValue: {
        fontSize: 16,
        fontWeight: '800',
    },
    selectedInfoSubtext: {
        fontSize: 11,
        marginTop: 4,
    },
    emptyChartState: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyChartText: {
        marginTop: 10,
        fontSize: 13,
        textAlign: 'center',
    },
    segmentedControlRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    segmentedControlButton: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        paddingVertical: 9,
        alignItems: 'center',
    },
    segmentedControlText: {
        fontSize: 12,
        fontWeight: '700',
    },
    topProductsList: {
        borderTopWidth: 0,
    },
    topProductItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    topProductRank: {
        width: 28,
        fontSize: 12,
        fontWeight: '700',
    },
    topProductImage: {
        width: 44,
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        marginRight: 10,
        overflow: 'hidden',
    },
    topProductMeta: {
        flex: 1,
        marginRight: 10,
    },
    topProductName: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    topProductSubtext: {
        fontSize: 11,
    },
    topProductMetric: {
        fontSize: 12,
        fontWeight: '700',
    },
    pieLayout: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    pieLegendWrap: {
        flex: 1,
    },
    pieLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    pieLegendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    pieLegendTextWrap: {
        flex: 1,
    },
    pieLegendLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    pieLegendValue: {
        fontSize: 11,
        marginTop: 1,
    },
    calendarLegendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    calendarLegendText: {
        fontSize: 11,
        fontWeight: '600',
    },
    calendarLegendScale: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    calendarLegendSwatch: {
        width: 18,
        height: 12,
        borderRadius: 4,
        borderWidth: 1,
    },
    calendarWeekdayRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    calendarWeekday: {
        width: `${100 / 7}%`,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: '700',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    calendarCell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarCellDay: {
        fontSize: 11,
        fontWeight: '600',
    },
});
