import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { calculateDiscount, formatPrice, formatPriceRange } from '../../utils/utils';

export interface ProductCardProps {
    readonly uid: string;
    readonly name: string;
    readonly thumbnailUrl: string;
    readonly minPrice: number;
    readonly maxPrice: number;
    readonly salePrice?: number | null;
    readonly originalPriceForSale?: number | null;
    readonly rating: number;
    readonly totalSales?: number;
    readonly onPress: (uid: string) => void;
    readonly width?: number | 'auto';
}

/**
 * Shared Product Card component wrapped in React.memo
 * @param props {ProductCardProps}
 */
export const ProductCard = React.memo<ProductCardProps>(({
    uid,
    name,
    thumbnailUrl,
    minPrice,
    maxPrice,
    salePrice,
    originalPriceForSale,
    rating,
    totalSales = 0,
    onPress,
    width = 'auto',
}) => {
    const isMultiVariant = minPrice !== maxPrice;

    // Determine the price string to show
    let priceDisplay: React.ReactNode;
    let discountBadge: React.ReactNode = null;

    if (salePrice && originalPriceForSale) {
        // Find discount percent
        const discountPct = calculateDiscount(originalPriceForSale, salePrice);

        discountBadge = (
            <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{discountPct}%</Text>
            </View>
        );

        if (isMultiVariant) {
            priceDisplay = (
                <View>
                    <Text style={styles.priceTextSale}>From {formatPrice(salePrice)}</Text>
                    <Text style={styles.originalPriceText}>{formatPrice(originalPriceForSale)}</Text>
                </View>
            );
        } else {
            priceDisplay = (
                <View style={styles.priceRow}>
                    <Text style={styles.priceTextSale}>{formatPrice(salePrice)}</Text>
                    <Text style={styles.originalPriceText}>{formatPrice(originalPriceForSale)}</Text>
                </View>
            );
        }
    } else {
        priceDisplay = (
            <Text style={styles.priceText}>{formatPriceRange(minPrice, maxPrice)}</Text>
        );
    }

    return (
        <TouchableOpacity
            style={[styles.container, { width: width as any }]}
            onPress={() => onPress(uid)}
            activeOpacity={0.8}
        >
            <View style={styles.imageContainer}>
                {thumbnailUrl ? (
                    <Image source={{ uri: thumbnailUrl }} style={styles.image} resizeMode="cover" />
                ) : (
                    <View style={styles.placeholderImage}>
                        <Text style={styles.placeholderText}>No Image</Text>
                    </View>
                )}
                {discountBadge}
            </View>

            <View style={styles.detailsContainer}>
                <Text style={styles.nameText} numberOfLines={2}>
                    {name}
                </Text>

                <View style={styles.priceSection}>
                    {priceDisplay}
                </View>

                <View style={styles.metaRow}>
                    <View style={styles.ratingContainer}>
                        <Text style={styles.starIcon}>★</Text>
                        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                    </View>
                    {totalSales > 0 && (
                        <Text style={styles.salesText}>{totalSales} sold</Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
});

ProductCard.displayName = 'ProductCard';

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        marginBottom: 16,
        marginHorizontal: 8,
        flex: 1, // for grid
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#F5F5F5',
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
        color: '#999',
        fontSize: 12,
    },
    discountBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FF3B30',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 4,
    },
    discountText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    detailsContainer: {
        padding: 12,
    },
    nameText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
        lineHeight: 18,
        minHeight: 36, // Ensure height stability for 2 lines
        marginBottom: 8,
    },
    priceSection: {
        marginBottom: 8,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    priceText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#007AFF', // Theme Primary
    },
    priceTextSale: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FF3B30', // Theme Danger/Sale
    },
    originalPriceText: {
        fontSize: 12,
        color: '#999',
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
        color: '#666',
        fontWeight: '500',
    },
    salesText: {
        fontSize: 10,
        color: '#999',
    }
});
