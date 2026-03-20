import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SEARCH_DEBOUNCE_MS } from '../utils/constants';
import { lightPalette } from '../utils/theme';
import { ProductCard } from './ui/product-card';

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
    readonly category: string | null;
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
                    style={searchStyles.input}
                    value={text}
                    onChangeText={handleChangeText}
                    placeholder={isShopSearch ? 'Search shops…' : placeholder}
                    placeholderTextColor={lightPalette.gray}
                    returnKeyType="search"
                    onSubmitEditing={() => onSearch(text)}
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {text.length > 0 && (
                    <TouchableOpacity
                        onPress={() => {
                            setText('');
                            onSearch('');
                        }}
                    >
                        <Text style={searchStyles.clearIcon}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>
            <TouchableOpacity
                style={[searchStyles.shopToggle, isShopSearch && searchStyles.shopToggleActive]}
                onPress={() => onToggleShopSearch(!isShopSearch)}
            >
                <Text
                    style={[
                        searchStyles.shopToggleText,
                        isShopSearch && searchStyles.shopToggleTextActive,
                    ]}
                >
                    🏪 Shop
                </Text>
            </TouchableOpacity>
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
        backgroundColor: lightPalette.cardBackground,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: lightPalette.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    icon: { fontSize: 16 },
    input: {
        flex: 1,
        fontSize: 14,
        color: lightPalette.textPrimary,
        padding: 0,
    },
    clearIcon: {
        fontSize: 14,
        color: lightPalette.gray,
    },
    shopToggle: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: lightPalette.border,
        backgroundColor: lightPalette.cardBackground,
    },
    shopToggleActive: {
        backgroundColor: lightPalette.primary,
        borderColor: lightPalette.primary,
    },
    shopToggleText: {
        fontSize: 13,
        color: lightPalette.textSecondary,
        fontWeight: '600',
    },
    shopToggleTextActive: {
        color: lightPalette.white,
    },
});

// ─── CatalogFilterPanel ────────────────────────────────────────────────────────

interface CatalogFilterPanelProps {
    readonly visible: boolean;
    readonly filters: CatalogFilterState;
    readonly onApply: (filters: CatalogFilterState) => void;
    readonly onClose: () => void;
}

const CATEGORY_OPTIONS = ['headwear', 'tops', 'bottoms', 'footwear', 'full_body', 'accessory'];
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
                <View style={filterStyles.panel}>
                    <View style={filterStyles.header}>
                        <Text style={filterStyles.title}>Filters</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={filterStyles.closeBtn}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Category */}
                        <Text style={filterStyles.sectionLabel}>Category</Text>
                        <View style={filterStyles.chipRow}>
                            {CATEGORY_OPTIONS.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        filterStyles.chip,
                                        localFilters.category === cat && filterStyles.chipActive,
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
                                            localFilters.category === cat &&
                                            filterStyles.chipTextActive,
                                        ]}
                                    >
                                        {formatCategoryLabel(cat)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Price Range */}
                        <Text style={filterStyles.sectionLabel}>Price Range (₱)</Text>
                        <View style={filterStyles.priceRow}>
                            <TextInput
                                style={filterStyles.priceInput}
                                placeholder="Min"
                                placeholderTextColor={lightPalette.gray}
                                keyboardType="numeric"
                                value={minPriceText}
                                onChangeText={setMinPriceText}
                            />
                            <Text style={filterStyles.priceSep}>–</Text>
                            <TextInput
                                style={filterStyles.priceInput}
                                placeholder="Max"
                                placeholderTextColor={lightPalette.gray}
                                keyboardType="numeric"
                                value={maxPriceText}
                                onChangeText={setMaxPriceText}
                            />
                        </View>

                        {/* Minimum Rating */}
                        <Text style={filterStyles.sectionLabel}>Minimum Rating</Text>
                        <View style={filterStyles.chipRow}>
                            {RATING_OPTIONS.map((r) => (
                                <TouchableOpacity
                                    key={r}
                                    style={[
                                        filterStyles.chip,
                                        localFilters.minRating === r && filterStyles.chipActive,
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
                                            localFilters.minRating === r &&
                                            filterStyles.chipTextActive,
                                        ]}
                                    >
                                        {'★'.repeat(r)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={filterStyles.footer}>
                        <TouchableOpacity style={filterStyles.resetBtn} onPress={handleReset}>
                            <Text style={filterStyles.resetText}>Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={filterStyles.applyBtn} onPress={handleApply}>
                            <Text style={filterStyles.applyText}>Apply Filters</Text>
                        </TouchableOpacity>
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
        backgroundColor: lightPalette.cardBackground,
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
        color: lightPalette.textPrimary,
    },
    closeBtn: { fontSize: 20, color: lightPalette.gray },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: lightPalette.textSecondary,
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
        borderColor: lightPalette.border,
        backgroundColor: lightPalette.background,
    },
    chipActive: { backgroundColor: lightPalette.primary, borderColor: lightPalette.primary },
    chipText: { fontSize: 13, color: lightPalette.textSecondary, fontWeight: '600' },
    chipTextActive: { color: lightPalette.white },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    priceInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: lightPalette.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: lightPalette.textPrimary,
    },
    priceSep: { fontSize: 16, color: lightPalette.textSecondary },
    footer: { flexDirection: 'row', gap: 12, marginTop: 24 },
    resetBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: lightPalette.border,
        alignItems: 'center',
    },
    resetText: { color: lightPalette.textSecondary, fontWeight: '600', fontSize: 15 },
    applyBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: lightPalette.primary,
        alignItems: 'center',
    },
    applyText: { color: lightPalette.white, fontWeight: '700', fontSize: 15 },
});

// ─── CatalogSortPicker ─────────────────────────────────────────────────────────

interface CatalogSortPickerProps {
    readonly visible: boolean;
    readonly selected: SortOption;
    readonly onSelect: (option: SortOption) => void;
    readonly onClose: () => void;
}

const SORT_OPTIONS: Array<{ value: SortOption; label: string; icon: string }> = [
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
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={sortStyles.overlay}>
                <View style={sortStyles.panel}>
                    <View style={sortStyles.header}>
                        <Text style={sortStyles.title}>Sort By</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={sortStyles.closeBtn}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    {SORT_OPTIONS.map((opt) => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[
                                sortStyles.option,
                                selected === opt.value && sortStyles.optionActive,
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
                                    selected === opt.value && sortStyles.optionLabelActive,
                                ]}
                            >
                                {opt.label}
                            </Text>
                            {selected === opt.value && (
                                <Text style={sortStyles.checkmark}>✓</Text>
                            )}
                        </TouchableOpacity>
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
        backgroundColor: lightPalette.cardBackground,
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
    title: { fontSize: 20, fontWeight: '700', color: lightPalette.textPrimary },
    closeBtn: { fontSize: 20, color: lightPalette.gray },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 12,
        marginBottom: 4,
    },
    optionActive: { backgroundColor: 'rgba(244,67,54,0.08)' },
    optionIcon: { fontSize: 18 },
    optionLabel: {
        flex: 1,
        fontSize: 15,
        color: lightPalette.textPrimary,
        fontWeight: '500',
    },
    optionLabelActive: { color: lightPalette.primary, fontWeight: '700' },
    checkmark: { fontSize: 16, color: lightPalette.primary, fontWeight: '700' },
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
    return (
        <TouchableOpacity
            style={shopCardStyles.container}
            onPress={() => onPress(shop.uid)}
            activeOpacity={0.8}
        >
            <View style={shopCardStyles.imageContainer}>
                {shop.bannerUrl ? (
                    <Image
                        source={{ uri: shop.bannerUrl }}
                        style={shopCardStyles.image}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={shopCardStyles.imageFallback}>
                        <Text style={shopCardStyles.imageFallbackText}>
                            {shop.shopName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>
            <Text style={shopCardStyles.name} numberOfLines={1}>
                {shop.shopName}
            </Text>
            <Text style={shopCardStyles.location} numberOfLines={1}>
                📍 {shop.city}, {shop.province}
            </Text>
            {(shop.orderCount ?? 0) > 0 && (
                <Text style={shopCardStyles.orders}>{shop.orderCount} orders</Text>
            )}
        </TouchableOpacity>
    );
};

const shopCardStyles = StyleSheet.create({
    container: {
        width: 130,
        marginRight: 12,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: lightPalette.cardBackground,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    imageContainer: {
        width: '100%',
        height: 80,
        backgroundColor: lightPalette.background,
    },
    image: { width: '100%', height: '100%' },
    imageFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: lightPalette.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageFallbackText: {
        color: lightPalette.white,
        fontSize: 32,
        fontWeight: '700',
    },
    name: {
        fontSize: 13,
        fontWeight: '700',
        color: lightPalette.textPrimary,
        paddingHorizontal: 10,
        paddingTop: 8,
    },
    location: {
        fontSize: 11,
        color: lightPalette.textSecondary,
        paddingHorizontal: 10,
        paddingTop: 2,
    },
    orders: {
        fontSize: 11,
        color: lightPalette.info,
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
    if (isLoading) {
        return (
            <View style={carouselStyles.loadingContainer}>
                <ActivityIndicator size="small" color={lightPalette.primary} />
            </View>
        );
    }
    if (shops.length === 0) return null;

    return (
        <View style={carouselStyles.section}>
            <Text style={carouselStyles.sectionTitle}>🏆 Featured Shops</Text>
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
    if (isLoading) {
        return (
            <View style={carouselStyles.loadingContainer}>
                <ActivityIndicator size="small" color={lightPalette.primary} />
            </View>
        );
    }
    if (products.length === 0) return null;

    return (
        <View style={carouselStyles.section}>
            <Text style={carouselStyles.sectionTitle}>🔥 Trending Now</Text>
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
    // Only show if user has activity history
    if (!hasActivity) return null;

    if (isLoading) {
        return (
            <View style={carouselStyles.loadingContainer}>
                <ActivityIndicator size="small" color={lightPalette.primary} />
            </View>
        );
    }
    if (products.length === 0) return null;

    return (
        <View style={carouselStyles.section}>
            <Text style={carouselStyles.sectionTitle}>✨ Recommended For You</Text>
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
        color: lightPalette.textPrimary,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
    },
    scrollContent: { paddingHorizontal: 16 },
    loadingContainer: {
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
