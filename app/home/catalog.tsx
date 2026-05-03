import { RipplePressable } from '@/components/ui/ripple-pressable';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dimensions, FlatList, RefreshControl, StyleSheet, Text, View
} from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { CatalogFilterPanel, CatalogFilterState, CatalogSearchBar, CatalogSortPicker, FeaturedShopsCarousel, RecommendedSection, SortOption, TrendingProductsCarousel } from '../../components/catalog-components';
import { AppHeader } from '../../components/ui/app-header';
import { EmptyList } from '../../components/ui/empty-list';
import { ProductCard } from '../../components/ui/product-card';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import type { CatalogProductItem, ShopCardItem } from '../../hooks/use-catalog';
import { useCatalogProducts, useFeaturedShops, useRecommendations, useTrendingProducts } from '../../hooks/use-catalog';
import { useCurrentUser } from '../../hooks/use-current-user';
import { GRID_MAX_COLUMN_WIDTH, GRID_MIN_COLUMN_WIDTH } from '../../utils/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 32;
const GAP = 16;
const COLUMN_WIDTH = Math.min(GRID_MAX_COLUMN_WIDTH, Math.max(GRID_MIN_COLUMN_WIDTH, (SCREEN_WIDTH - PADDING - GAP) / 2));
const CATALOG_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

// ─── Catalog Grid Skeleton ────────────────────────────────────────────────────

/** Placeholder grid shown while the initial product list is loading. */
const CatalogGridSkeleton: React.FC = () => (
    <View style={skeletonStyles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ width: COLUMN_WIDTH }}>
                <SkeletonLoader height={COLUMN_WIDTH * 1.25} borderRadius={8} style={{ marginBottom: 8 }} />
                <SkeletonLoader height={13} width="80%" style={{ marginBottom: 5 }} />
                <SkeletonLoader height={12} width="50%" />
            </View>
        ))}
    </View>
);

const skeletonStyles = StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 16, paddingTop: 8, paddingBottom: 16 },
});

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Catalog page — the main product discovery screen.
 * Shows featured shops, trending, recommendations, search/filter/sort, and paginated grid.
 */
export default function CatalogScreen(): React.JSX.Element {
    const { theme } = useTheme();

    // ── Search / filter / sort state (UI-local, not server state) ─────────
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isShopSearch, setIsShopSearch] = useState<boolean>(false);
    const [filters, setFilters] = useState<CatalogFilterState>({
        category: null,
        minPrice: null,
        maxPrice: null,
        minRating: null,
    });
    const [sortOption, setSortOption] = useState<SortOption>('newest');
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [showSort, setShowSort] = useState<boolean>(false);

    const catalogFilters = {
        query: searchQuery,
        isShopSearch,
        category: filters.category,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minRating: filters.minRating,
        sort: sortOption,
    };

    // ── Queries ───────────────────────────────────────────────────────────
    const { data: currentUser } = useCurrentUser();
    const userId = currentUser?.id ?? null;

    const {
        data: productsData,
        isLoading: productsLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        refetch: refetchProducts,
        isRefetching: isRefetchingProducts,
    } = useCatalogProducts(catalogFilters);

    const { data: featuredShops = [], isLoading: shopsLoading, refetch: refetchShops } = useFeaturedShops();
    const { data: trendingProducts = [], isLoading: trendingLoading, refetch: refetchTrending } = useTrendingProducts();
    const { data: recommendationsData, isLoading: recommendedLoading } = useRecommendations(userId);

    const products: CatalogProductItem[] = productsData?.pages.flatMap((p) => p.items) ?? [];
    const recommendedProducts = useMemo(() => recommendationsData?.products ?? [], [recommendationsData?.products]);
    const hasActivity = recommendationsData?.hasActivity ?? false;

    // ── Redirect sellers to seller dashboard ─────────────────────────────
    useEffect(() => {
        if (currentUser?.role === 'seller') {
            router.push('/home/seller-dashboard');
        }
    }, [currentUser?.role]);

    // ── Handlers ─────────────────────────────────────────────────────────

    const handleRefresh = useCallback(async (): Promise<void> => {
        await Promise.all([refetchShops(), refetchTrending(), refetchProducts()]);
    }, [refetchShops, refetchTrending, refetchProducts]);

    const handleEndReached = useCallback((): void => {
        if (!isFetchingNextPage && hasNextPage) {
            void fetchNextPage();
        }
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    const handleProductPress = useCallback((uid: string): void => {
        router.push({ pathname: '/home/product-details' as string, params: { uid } } as Parameters<typeof router.push>[0]);
    }, []);

    const handleShopPress = useCallback((uid: string): void => {
        router.push({ pathname: '/home/shop-landing' as string, params: { uid } } as Parameters<typeof router.push>[0]);
    }, []);

    const handleClearFilters = useCallback((): void => {
        setFilters({ category: null, minPrice: null, maxPrice: null, minRating: null });
        setSearchQuery('');
        setIsShopSearch(false);
        setSortOption('newest');
    }, []);

    const hasActiveFilters = filters.category !== null || filters.minPrice !== null || filters.maxPrice !== null || filters.minRating !== null;

    // ── Render helpers ────────────────────────────────────────────────────

    const renderItem = useCallback(({ item }: { item: CatalogProductItem }): React.JSX.Element => (
        <ProductCard
            uid={item.uid}
            name={item.name}
            thumbnailUrl={item.thumbnailUrl}
            minPrice={item.minPrice}
            maxPrice={item.maxPrice}
            totalStock={item.totalStock}
            salePrice={item.salePrice}
            originalPriceForSale={item.originalPriceForSale}
            rating={item.rating}
            totalSales={item.totalSales}
            onPress={handleProductPress}
            width={COLUMN_WIDTH}
        />
    ), [handleProductPress]);

    const ListHeader = useCallback((): React.JSX.Element => (
        <View>
            <FeaturedShopsCarousel shops={featuredShops as ShopCardItem[]} onShopPress={handleShopPress} isLoading={shopsLoading} />
            <TrendingProductsCarousel products={trendingProducts as CatalogProductItem[]} onProductPress={handleProductPress} isLoading={trendingLoading} />
            <RecommendedSection products={recommendedProducts as CatalogProductItem[]} onProductPress={handleProductPress} isLoading={recommendedLoading} hasActivity={hasActivity} />

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <CatalogSearchBar onSearch={setSearchQuery} onToggleShopSearch={setIsShopSearch} isShopSearch={isShopSearch} />
            <View style={styles.controlsRow}>
                <RipplePressable
                    style={[
                        styles.controlBtn,
                        { borderColor: theme.border, backgroundColor: theme.cardBackground },
                        hasActiveFilters && { borderColor: theme.primary, backgroundColor: `${theme.primary}12` },
                    ]}
                    onPress={() => setShowFilters(true)}
                >
                    <Text style={[styles.controlBtnText, { color: hasActiveFilters ? theme.primary : theme.textSecondary }]}>
                        ⚙️ Filter{hasActiveFilters ? ' ●' : ''}
                    </Text>
                </RipplePressable>
                <RipplePressable
                    style={[styles.controlBtn, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                    onPress={() => setShowSort(true)}
                >
                    <Text style={[styles.controlBtnText, { color: theme.textSecondary }]}>↕️ Sort</Text>
                </RipplePressable>
            </View>
            <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>All Products</Text>
        </View>
    ), [
        featuredShops, shopsLoading, trendingProducts, trendingLoading,
        recommendedProducts, recommendedLoading, hasActivity, handleShopPress,
        handleProductPress, isShopSearch, hasActiveFilters, theme,
    ]);

    const ListFooter = useCallback((): React.JSX.Element | null =>
        isFetchingNextPage ? (
            <View style={styles.footerLoading}>
                <Text style={[styles.footerText, { color: theme.gray }]}>Loading more…</Text>
            </View>
        ) : null,
        [isFetchingNextPage, theme]);

    const ListEmpty = useCallback((): React.JSX.Element => (
        <EmptyList
            icon={<Text style={styles.emptyIcon}>🛍️</Text>}
            message="No products found"
            submessage={hasActiveFilters || searchQuery ? 'Try adjusting your search or filters.' : 'Check back later!'}
            actionButton={hasActiveFilters || searchQuery ? { label: 'Clear Filters', onPress: handleClearFilters } : undefined}
        />
    ), [hasActiveFilters, searchQuery, handleClearFilters]);

    return (
        <SafeScreen style={styles.root} edges={CATALOG_SAFE_AREA_EDGES}>
            <AppHeader
                userAvatarUrl={currentUser?.avatarUrl ?? null}
                userRole={currentUser?.role ?? 'buyer'}
            />

            <FlatList
                data={products}
                keyExtractor={(item) => item.uid}
                numColumns={2}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                ListEmptyComponent={productsLoading ? CatalogGridSkeleton : ListEmpty}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.3}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetchingProducts}
                        onRefresh={() => { void handleRefresh(); }}
                        colors={[theme.primary]}
                    />
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={styles.columnWrapper}
            />

            <CatalogFilterPanel visible={showFilters} filters={filters} onApply={setFilters} onClose={() => setShowFilters(false)} />
            <CatalogSortPicker visible={showSort} selected={sortOption} onSelect={setSortOption} onClose={() => setShowSort(false)} />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    listContent: { paddingBottom: 0 },
    columnWrapper: { paddingHorizontal: 8 },
    divider: { height: 4, marginVertical: 8 },
    controlsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
    controlBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    controlBtnText: { fontSize: 14, fontWeight: '600' },
    sectionHeading: {
        fontSize: 17,
        fontWeight: '700',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
    },
    footerLoading: { paddingVertical: 16, alignItems: 'center' },
    footerText: { fontSize: 13 },
    emptyIcon: { fontSize: 40 },
});
