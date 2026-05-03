import { RipplePressable } from '@/components/ui/ripple-pressable';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
    calculateDiscount,
    formatPrice,
    formatPriceRange,
    getInventoryStockLabel,
    getInventoryStockState,
} from '../../utils/utils';
import { useTheme } from './theme-provider';

export interface ProductCardProps {
    readonly uid: string;
    readonly name: string;
    readonly thumbnailUrl: string;
    readonly minPrice: number;
    readonly maxPrice: number;
    readonly totalStock?: number;
    readonly salePrice?: number | null;
    readonly originalPriceForSale?: number | null;
    readonly rating: number;
    readonly totalSales?: number;
    readonly onPress: (uid: string) => void;
    readonly width?: number | 'auto';
}

/**
 * Shared Product Card component. Uses the active theme for all colors.
 * Wrapped in React.memo for rendering efficiency.
 * @param props {ProductCardProps}
 */
const ProductCardComponent: React.FC<ProductCardProps> = ({
    uid,
    name,
    thumbnailUrl,
    minPrice,
    maxPrice,
    totalStock = 0,
    salePrice,
    originalPriceForSale,
    rating,
    totalSales = 0,
    onPress,
    width = 'auto',
}) => {
    const { theme } = useTheme();
    const isMultiVariant = minPrice !== maxPrice;
    const stockState = getInventoryStockState(totalStock);
    const stockLabel = getInventoryStockLabel(totalStock);

    const stockBadgeBackgroundColor = stockState === 'sold-out'
        ? theme.error
        : stockState === 'low-stock'
            ? theme.warning
            : theme.success;

    let priceDisplay: React.ReactNode;
    let discountBadge: React.ReactNode = null;

    if (salePrice && originalPriceForSale) {
        const discountPct = calculateDiscount(originalPriceForSale, salePrice);

        discountBadge = (
            <View style={[styles.discountBadge, { backgroundColor: theme.error }]}>
                <Text style={[styles.discountText, { color: theme.white }]}>-{discountPct}%</Text>
            </View>
        );

        if (isMultiVariant) {
            priceDisplay = (
                <View>
                    <Text style={[styles.priceTextSale, { color: theme.error }]}>From {formatPrice(salePrice)}</Text>
                    <Text style={styles.originalPriceText}>{formatPrice(originalPriceForSale)}</Text>
                </View>
            );
        } else {
            priceDisplay = (
                <View style={styles.priceRow}>
                    <Text style={[styles.priceTextSale, { color: theme.error }]}>{formatPrice(salePrice)}</Text>
                    <Text style={styles.originalPriceText}>{formatPrice(originalPriceForSale)}</Text>
                </View>
            );
        }
    } else {
        priceDisplay = (
            <Text style={[styles.priceText, { color: theme.primary }]}>{formatPriceRange(minPrice, maxPrice)}</Text>
        );
    }

    return (
        <RipplePressable
            style={[styles.container, { backgroundColor: theme.cardBackground, width }]}
            onPress={() => onPress(uid)}
            activeOpacity={0.8}
        >
            <View style={[styles.imageContainer, { backgroundColor: theme.background }]}>
                {thumbnailUrl ? (
                    <Image
                        source={{ uri: thumbnailUrl }}
                        style={styles.image}
                        contentFit="cover"
                        transition={120}
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <View style={styles.placeholderImage}>
                        <Text style={[styles.placeholderText, { color: theme.gray }]}>No Image</Text>
                    </View>
                )}
                {discountBadge}
                <View style={[styles.stockBadge, { backgroundColor: stockBadgeBackgroundColor }]}>
                    <Text style={[styles.stockBadgeText, { color: theme.white }]}>
                        {stockLabel}
                    </Text>
                </View>
            </View>

            <View style={styles.detailsContainer}>
                <Text style={[styles.nameText, { color: theme.textPrimary }]} numberOfLines={2}>
                    {name}
                </Text>

                <View style={styles.priceSection}>
                    {priceDisplay}
                </View>

                <Text style={[styles.stockText, { color: theme.textSecondary }]}>
                    {stockState === 'sold-out' ? '0 left' : `${totalStock} left`}
                </Text>

                <View style={styles.metaRow}>
                    <View style={styles.ratingContainer}>
                        <Text style={styles.starIcon}>★</Text>
                        <Text style={[styles.ratingText, { color: theme.textSecondary }]}>{rating.toFixed(1)}</Text>
                    </View>
                    {totalSales > 0 && (
                        <Text style={[styles.salesText, { color: theme.gray }]}>{totalSales} sold</Text>
                    )}
                </View>
            </View>
        </RipplePressable>
    );
};

export const ProductCard = React.memo<ProductCardProps>(ProductCardComponent);
ProductCard.displayName = 'ProductCard';

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        marginBottom: 16,
        marginHorizontal: 8,
        flex: 1,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 1,
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 12,
    },
    discountBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 4,
    },
    stockBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    discountText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    stockBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    detailsContainer: {
        padding: 12,
    },
    nameText: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 18,
        minHeight: 36,
        marginBottom: 8,
    },
    priceSection: {
        marginBottom: 8,
    },
    stockText: {
        fontSize: 11,
        marginBottom: 8,
        fontWeight: '600',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    priceText: {
        fontSize: 16,
        fontWeight: '700',
    },
    priceTextSale: {
        fontSize: 16,
        fontWeight: '700',
    },
    originalPriceText: {
        fontSize: 12,
        color: '#ADB5BD',
        textDecorationLine: 'line-through',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    starIcon: {
        color: '#FFCC00',
        fontSize: 14,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '500',
    },
    salesText: {
        fontSize: 10,
    }
});
