import { RipplePressable } from '@/components/ui/ripple-pressable';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SEARCH_DEBOUNCE_MS } from '../utils/constants';
import type { ProductCategory } from '../utils/types';
import { ProductCard } from './ui/product-card';
import { SkeletonLoader } from './ui/skeleton-loader';
import { useTheme } from './ui/theme-provider';

/** Debounce hook helper (inline to avoid extra file) */
function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
    fn: T,
    delay: number
): T {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    return useCallback(
        ((...args: Parameters<T>) => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => fn(...args), delay);
        }) as T,
        [fn, delay]
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortOption =
    | 'newest'
    | 'price_asc'
    | 'price_desc'
    | 'best_rating'
    | 'best_sellers'
    | 'by_shop';

export interface CatalogFilterState {
    readonly category: ProductCategory | null;
    readonly minPrice: number | null;
    readonly maxPrice: number | null;
    readonly minRating: number | null;
}

export interface CatalogProductItem {
    readonly uid: string;
    readonly name: string;
    readonly thumbnailUrl: string;
    readonly minPrice: number;
    readonly maxPrice: number;
    readonly totalStock: number;
    readonly salePrice?: number | null;
    readonly originalPriceForSale?: number | null;
    readonly rating: number;
    readonly totalSales?: number;
}

export interface ShopCardItem {
    readonly uid: string;
    readonly shopName: string;
    readonly bannerUrl?: string | null;
    readonly city: string;
    readonly province: string;
    readonly orderCount?: number;
}

// ─── CatalogSearchBar ─────────────────────────────────────────────────────────

interface CatalogSearchBarProps {
    readonly onSearch: (query: string) => void;
    readonly onToggleShopSearch: (active: boolean) => void;
    readonly isShopSearch: boolean;
    readonly placeholder?: string;
}

/**
 * Search bar for the catalog with debounced input and a shop search toggle.
 * @param props {CatalogSearchBarProps}
 */
export const CatalogSearchBar: React.FC<CatalogSearchBarProps> = ({
    onSearch,
    onToggleShopSearch,
    isShopSearch,
    placeholder = 'Search products…',
}) => {
    const { theme } = useTheme();
    const [text, setText] = useState<string>('');

    const debouncedSearch = useDebouncedCallback(onSearch, SEARCH_DEBOUNCE_MS);

    const handleChangeText = useCallback(
        (val: string): void => {
            setText(val);
            debouncedSearch(val);
        },
        [debouncedSearch]
    );

    return (
        <View style={searchStyles.container}>
            <View style={searchStyles.inputRow}>
                <Text style={searchStyles.icon}>🔍</Text>
                <TextInput
                    style={[searchStyles.input, { color: theme.textPrimary }]}
                    value={text}
                    onChangeText={handleChangeText}
                    placeholder={isShopSearch ? 'Search shops…' : placeholder}
                    placeholderTextColor={theme.gray}
                    returnKeyType="search"
                    onSubmitEditing={() => onSearch(text)}
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {text.length > 0 && (
                    <RipplePressable
                        onPress={() => {
                            setText('');
                            onSearch('');
                        }}
                    >
                        <Text style={[searchStyles.clearIcon, { color: theme.gray }]}>✕</Text>
                    </RipplePressable>
                )}
            </View>
            <RipplePressable
                style={[
                    searchStyles.shopToggle,
                    { borderColor: theme.border, backgroundColor: theme.cardBackground },
                    isShopSearch && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => onToggleShopSearch(!isShopSearch)}
            >
                <Text
                    style={[
                        searchStyles.shopToggleText,
                        { color: isShopSearch ? theme.white : theme.textSecondary },
                    ]}
                >
                    🏪 Shop
                </Text>
            </RipplePressable>
        </View>
    );
};

const searchStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    inputRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    icon: { fontSize: 16 },
    input: {
        flex: 1,
        fontSize: 14,
        padding: 0,
    },
    clearIcon: {
        fontSize: 14,
    },
    shopToggle: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    shopToggleText: {
        fontSize: 13,
        fontWeight: '600',
    },
});

// ─── CatalogFilterPanel ────────────────────────────────────────────────────────

interface CatalogFilterPanelProps {
    readonly visible: boolean;
    readonly filters: CatalogFilterState;
    readonly onApply: (filters: CatalogFilterState) => void;
    readonly onClose: () => void;
}

const CATEGORY_OPTIONS: readonly ProductCategory[] = ['headwear', 'upperwear', 'lowerwear', 'footwear', 'accessory'];
const RATING_OPTIONS = [1, 2, 3, 4, 5];

function formatCategoryLabel(category: string): string {
    return category
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}

/**
 * Modal filter panel for categories, price range, and minimum rating.
 * @param props {CatalogFilterPanelProps}
 */
export const CatalogFilterPanel: React.FC<CatalogFilterPanelProps> = ({
    visible,
    filters,
    onApply,
    onClose,
}) => {
    const { theme } = useTheme();
    const [localFilters, setLocalFilters] = useState<CatalogFilterState>(filters);
    const [minPriceText, setMinPriceText] = useState<string>(
        filters.minPrice !== null ? String(filters.minPrice) : ''
    );
    const [maxPriceText, setMaxPriceText] = useState<string>(
        filters.maxPrice !== null ? String(filters.maxPrice) : ''
    );

    const handleApply = useCallback((): void => {
        const minPrice = minPriceText.trim() ? parseFloat(minPriceText) : null;
        const maxPrice = maxPriceText.trim() ? parseFloat(maxPriceText) : null;
        onApply({ ...localFilters, minPrice, maxPrice });
        onClose();
    }, [localFilters, minPriceText, maxPriceText, onApply, onClose]);

    const handleReset = useCallback((): void => {
        const reset: CatalogFilterState = {
            category: null,
            minPrice: null,
            maxPrice: null,
            minRating: null,
        };
        setLocalFilters(reset);
        setMinPriceText('');
        setMaxPriceText('');
    }, []);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={filterStyles.overlay}>
                <View style={[filterStyles.panel, { backgroundColor: theme.cardBackground }]}>
                    <View style={filterStyles.header}>
                        <Text style={[filterStyles.title, { color: theme.textPrimary }]}>Filters</Text>
                        <RipplePressable onPress={onClose}>
                            <Text style={[filterStyles.closeBtn, { color: theme.gray }]}>✕</Text>
                        </RipplePressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Category */}
                        <Text style={[filterStyles.sectionLabel, { color: theme.textSecondary }]}>Category</Text>
                        <View style={filterStyles.chipRow}>
                            {CATEGORY_OPTIONS.map((cat) => (
                                <RipplePressable
                                    key={cat}
                                    style={[
                                        filterStyles.chip,
                                        {
                                            borderColor: localFilters.category === cat ? theme.primary : theme.border,
                                            backgroundColor: localFilters.category === cat ? theme.primary : theme.background,
                                        },
                                    ]}
                                    onPress={() =>
                                        setLocalFilters((prev) => ({
                                            ...prev,
                                            category: prev.category === cat ? null : cat,
                                        }))
                                    }
                                >
                                    <Text
                                        style={[
                                            filterStyles.chipText,
                                            { color: localFilters.category === cat ? theme.white : theme.textSecondary },
                                        ]}
                                    >
                                        {formatCategoryLabel(cat)}
                                    </Text>
                                </RipplePressable>
                            ))}
                        </View>

                        {/* Price Range */}
                        <Text style={[filterStyles.sectionLabel, { color: theme.textSecondary }]}>Price Range (₱)</Text>
                        <View style={filterStyles.priceRow}>
                            <TextInput
                                style={[filterStyles.priceInput, { borderColor: theme.border, color: theme.textPrimary }]}
                                placeholder="Min"
                                placeholderTextColor={theme.gray}
                                keyboardType="numeric"
                                value={minPriceText}
                                onChangeText={setMinPriceText}
                            />
                            <Text style={[filterStyles.priceSep, { color: theme.textSecondary }]}>–</Text>
                            <TextInput
                                style={[filterStyles.priceInput, { borderColor: theme.border, color: theme.textPrimary }]}
                                placeholder="Max"
                                placeholderTextColor={theme.gray}
                                keyboardType="numeric"
                                value={maxPriceText}
                                onChangeText={setMaxPriceText}
                            />
                        </View>

                        {/* Minimum Rating */}
                        <Text style={[filterStyles.sectionLabel, { color: theme.textSecondary }]}>Minimum Rating</Text>
                        <View style={filterStyles.chipRow}>
                            {RATING_OPTIONS.map((r) => (
                                <RipplePressable
                                    key={r}
                                    style={[
                                        filterStyles.chip,
                                        {
                                            borderColor: localFilters.minRating === r ? theme.primary : theme.border,
                                            backgroundColor: localFilters.minRating === r ? theme.primary : theme.background,
                                        },
                                    ]}
                                    onPress={() =>
                                        setLocalFilters((prev) => ({
                                            ...prev,
                                            minRating: prev.minRating === r ? null : r,
                                        }))
                                    }
                                >
                                    <Text
                                        style={[
                                            filterStyles.chipText,
                                            { color: localFilters.minRating === r ? theme.white : theme.textSecondary },
                                        ]}
                                    >
                                        {'★'.repeat(r)}
                                    </Text>
                                </RipplePressable>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={filterStyles.footer}>
                        <RipplePressable style={[filterStyles.resetBtn, { borderColor: theme.border }]} onPress={handleReset}>
                            <Text style={[filterStyles.resetText, { color: theme.textSecondary }]}>Reset</Text>
                        </RipplePressable>
                        <RipplePressable style={[filterStyles.applyBtn, { backgroundColor: theme.primary }]} onPress={handleApply}>
                            <Text style={[filterStyles.applyText, { color: theme.white }]}>Apply Filters</Text>
                        </RipplePressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const filterStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    panel: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '85%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
    },
    closeBtn: { fontSize: 20 },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 16,
        marginBottom: 10,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipText: { fontSize: 13, fontWeight: '600' },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    priceInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
    },
    priceSep: { fontSize: 16 },
    footer: { flexDirection: 'row', gap: 12, marginTop: 24 },
    resetBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    resetText: { fontWeight: '600', fontSize: 15 },
    applyBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    applyText: { fontWeight: '700', fontSize: 15 },
});

// ─── CatalogSortPicker ─────────────────────────────────────────────────────────

interface CatalogSortPickerProps {
    readonly visible: boolean;
    readonly selected: SortOption;
    readonly onSelect: (option: SortOption) => void;
    readonly onClose: () => void;
}

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
    { value: 'newest', label: 'Newest First', icon: '🆕' },
    { value: 'price_asc', label: 'Price: Low to High', icon: '💰' },
    { value: 'price_desc', label: 'Price: High to Low', icon: '💎' },
    { value: 'best_rating', label: 'Best Rating', icon: '⭐' },
    { value: 'best_sellers', label: 'Best Sellers', icon: '🔥' },
    { value: 'by_shop', label: 'Sort by Shop', icon: '🏪' },
];

/**
 * Sort picker modal for the catalog page.
 * @param props {CatalogSortPickerProps}
 */
export const CatalogSortPicker: React.FC<CatalogSortPickerProps> = ({
    visible,
    selected,
    onSelect,
    onClose,
}) => {
    const { theme } = useTheme();

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={sortStyles.overlay}>
                <View style={[sortStyles.panel, { backgroundColor: theme.cardBackground }]}>
                    <View style={sortStyles.header}>
                        <Text style={[sortStyles.title, { color: theme.textPrimary }]}>Sort By</Text>
                        <RipplePressable onPress={onClose}>
                            <Text style={[sortStyles.closeBtn, { color: theme.gray }]}>✕</Text>
                        </RipplePressable>
                    </View>
                    {SORT_OPTIONS.map((opt) => (
                        <RipplePressable
                            key={opt.value}
                            style={[
                                sortStyles.option,
                                selected === opt.value && { backgroundColor: `${theme.primary}14` },
                            ]}
                            onPress={() => {
                                onSelect(opt.value);
                                onClose();
                            }}
                        >
                            <Text style={sortStyles.optionIcon}>{opt.icon}</Text>
                            <Text
                                style={[
                                    sortStyles.optionLabel,
                                    { color: selected === opt.value ? theme.primary : theme.textPrimary },
                                    selected === opt.value && sortStyles.optionLabelActive,
                                ]}
                            >
                                {opt.label}
                            </Text>
                            {selected === opt.value && (
                                <Text style={[sortStyles.checkmark, { color: theme.primary }]}>✓</Text>
                            )}
                        </RipplePressable>
                    ))}
                </View>
            </View>
        </Modal>
    );
};

const sortStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    panel: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 36,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: { fontSize: 20, fontWeight: '700' },
    closeBtn: { fontSize: 20 },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 12,
        marginBottom: 4,
    },
    optionIcon: { fontSize: 18 },
    optionLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
    },
    optionLabelActive: { fontWeight: '700' },
    checkmark: { fontSize: 16, fontWeight: '700' },
});

// ─── CatalogGrid ──────────────────────────────────────────────────────────────

interface CatalogGridProps {
    readonly products: CatalogProductItem[];
    readonly onProductPress: (uid: string) => void;
    readonly columnWidth: number;
}

/**
 * 2-column grid for catalog products using memoized ProductCard.
 * @param props {CatalogGridProps}
 */
export const CatalogGrid: React.FC<CatalogGridProps> = ({
    products,
    onProductPress,
    columnWidth,
}) => {
    const renderItem = useCallback(
        ({ item }: { item: CatalogProductItem }): React.JSX.Element => (
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
                onPress={onProductPress}
                width={columnWidth}
            />
        ),
        [onProductPress, columnWidth]
    );

    return (
        <FlatList
            data={products}
            renderItem={renderItem}
            keyExtractor={(item) => item.uid}
            numColumns={2}
            scrollEnabled={false}
            contentContainerStyle={gridStyles.container}
        />
    );
};

const gridStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 8,
    },
});

// ─── ShopCard ─────────────────────────────────────────────────────────────────

interface ShopCardProps {
    readonly shop: ShopCardItem;
    readonly onPress: (uid: string) => void;
}

/**
 * Card for displaying a shop in the featured shops carousel.
 * @param props {ShopCardProps}
 */
export const ShopCard: React.FC<ShopCardProps> = ({ shop, onPress }) => {
    const { theme } = useTheme();

    return (
        <RipplePressable
            style={[shopCardStyles.container, { backgroundColor: theme.cardBackground }]}
            onPress={() => onPress(shop.uid)}
            activeOpacity={0.8}
        >
            <View style={[shopCardStyles.imageContainer, { backgroundColor: theme.background }]}>
                {shop.bannerUrl ? (
                    <Image
                        source={{ uri: shop.bannerUrl }}
                        style={shopCardStyles.image}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[shopCardStyles.imageFallback, { backgroundColor: theme.primary }]}>
                        <Text style={[shopCardStyles.imageFallbackText, { color: theme.white }]}>
                            {shop.shopName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>
            <Text style={[shopCardStyles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                {shop.shopName}
            </Text>
            <Text style={[shopCardStyles.location, { color: theme.textSecondary }]} numberOfLines={1}>
                📍 {shop.city}, {shop.province}
            </Text>
            {(shop.orderCount ?? 0) > 0 && (
                <Text style={[shopCardStyles.orders, { color: theme.info }]}>{shop.orderCount} orders</Text>
            )}
        </RipplePressable>
    );
};

const shopCardStyles = StyleSheet.create({
    container: {
        width: 130,
        marginRight: 12,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    imageContainer: {
        width: '100%',
        height: 80,
    },
    image: { width: '100%', height: '100%' },
    imageFallback: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageFallbackText: {
        fontSize: 32,
        fontWeight: '700',
    },
    name: {
        fontSize: 13,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingTop: 8,
    },
    location: {
        fontSize: 11,
        paddingHorizontal: 10,
        paddingTop: 2,
    },
    orders: {
        fontSize: 11,
        paddingHorizontal: 10,
        paddingBottom: 10,
        paddingTop: 2,
        fontWeight: '600',
    },
});

// ─── FeaturedShopsCarousel ────────────────────────────────────────────────────

interface FeaturedShopsCarouselProps {
    readonly shops: ShopCardItem[];
    readonly onShopPress: (uid: string) => void;
    readonly isLoading: boolean;
}

/**
 * Horizontal carousel of featured shop cards.
 * @param props {FeaturedShopsCarouselProps}
 */
export const FeaturedShopsCarousel: React.FC<FeaturedShopsCarouselProps> = ({
    shops,
    onShopPress,
    isLoading,
}) => {
    const { theme } = useTheme();

    if (isLoading) {
        return (
            <View style={carouselStyles.section}>
                <Text style={[carouselStyles.sectionTitle, { color: theme.textPrimary }]}>🏆 Featured Shops</Text>
                <View style={carouselStyles.scrollContent}>
                    <View style={carouselStyles.shopSkeletonRow}>
                        {Array.from({ length: 3 }).map((_, index) => (
                            <View key={`featured-shop-skeleton-${index}`} style={carouselStyles.shopSkeletonCard}>
                                <SkeletonLoader height={80} borderRadius={12} />
                                <SkeletonLoader height={12} width="85%" style={{ marginTop: 8 }} />
                                <SkeletonLoader height={10} width="65%" style={{ marginTop: 6 }} />
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        );
    }
    if (shops.length === 0) return null;

    return (
        <View style={carouselStyles.section}>
            <Text style={[carouselStyles.sectionTitle, { color: theme.textPrimary }]}>🏆 Featured Shops</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={carouselStyles.scrollContent}
            >
                {shops.map((shop) => (
                    <ShopCard key={shop.uid} shop={shop} onPress={onShopPress} />
                ))}
            </ScrollView>
        </View>
    );
};

// ─── TrendingProductsCarousel ──────────────────────────────────────────────────

interface TrendingProductsCarouselProps {
    readonly products: CatalogProductItem[];
    readonly onProductPress: (uid: string) => void;
    readonly isLoading: boolean;
}

/**
 * Horizontal carousel of trending products.
 * @param props {TrendingProductsCarouselProps}
 */
export const TrendingProductsCarousel: React.FC<TrendingProductsCarouselProps> = ({
    products,
    onProductPress,
    isLoading,
}) => {
    const { theme } = useTheme();

    if (isLoading) {
        return (
            <View style={carouselStyles.section}>
                <Text style={[carouselStyles.sectionTitle, { color: theme.textPrimary }]}>🔥 Trending Now</Text>
                <View style={carouselStyles.scrollContent}>
                    <View style={carouselStyles.productSkeletonRow}>
                        {Array.from({ length: 2 }).map((_, index) => (
                            <View key={`trending-product-skeleton-${index}`} style={carouselStyles.productSkeletonCard}>
                                <SkeletonLoader height={160} borderRadius={10} />
                                <SkeletonLoader height={13} width="85%" style={{ marginTop: 8 }} />
                                <SkeletonLoader height={12} width="55%" style={{ marginTop: 6 }} />
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        );
    }
    if (products.length === 0) return null;

    return (
        <View style={carouselStyles.section}>
            <Text style={[carouselStyles.sectionTitle, { color: theme.textPrimary }]}>🔥 Trending Now</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={carouselStyles.scrollContent}
            >
                {products.map((item) => (
                    <ProductCard
                        key={item.uid}
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
                        onPress={onProductPress}
                        width={160}
                    />
                ))}
            </ScrollView>
        </View>
    );
};

// ─── RecommendedSection ────────────────────────────────────────────────────────

interface RecommendedSectionProps {
    readonly products: CatalogProductItem[];
    readonly onProductPress: (uid: string) => void;
    readonly isLoading: boolean;
    readonly hasActivity: boolean;
}

/**
 * Horizontal section of recommended products (only shown when user has activity history).
 * @param props {RecommendedSectionProps}
 */
export const RecommendedSection: React.FC<RecommendedSectionProps> = ({
    products,
    onProductPress,
    isLoading,
    hasActivity,
}) => {
    const { theme } = useTheme();

    // Only show if user has activity history
    if (!hasActivity) return null;

    if (isLoading) {
        return (
            <View style={carouselStyles.section}>
                <Text style={[carouselStyles.sectionTitle, { color: theme.textPrimary }]}>✨ Recommended For You</Text>
                <View style={carouselStyles.scrollContent}>
                    <View style={carouselStyles.productSkeletonRow}>
                        {Array.from({ length: 2 }).map((_, index) => (
                            <View key={`recommended-product-skeleton-${index}`} style={carouselStyles.productSkeletonCard}>
                                <SkeletonLoader height={160} borderRadius={10} />
                                <SkeletonLoader height={13} width="85%" style={{ marginTop: 8 }} />
                                <SkeletonLoader height={12} width="55%" style={{ marginTop: 6 }} />
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        );
    }
    if (products.length === 0) return null;

    return (
        <View style={carouselStyles.section}>
            <Text style={[carouselStyles.sectionTitle, { color: theme.textPrimary }]}>✨ Recommended For You</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={carouselStyles.scrollContent}
            >
                {products.map((item) => (
                    <ProductCard
                        key={item.uid}
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
                        onPress={onProductPress}
                        width={160}
                    />
                ))}
            </ScrollView>
        </View>
    );
};

const carouselStyles = StyleSheet.create({
    section: { marginBottom: 4 },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
    },
    scrollContent: { paddingHorizontal: 16 },
    shopSkeletonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    shopSkeletonCard: {
        width: 130,
    },
    productSkeletonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    productSkeletonCard: {
        width: 160,
    },
});
