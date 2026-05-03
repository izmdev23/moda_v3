import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RipplePressable } from '@/components/ui/ripple-pressable';
import type { Edge } from 'react-native-safe-area-context';
import { StoreProductsGrid } from '../../components/shop-landing-components';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import type { MyStoreProduct } from '../../hooks/use-my-store';
import { useMyStoreData } from '../../hooks/use-my-store';

const SHOP_TAG_PRODUCTS_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];
const UNTAGGED_SECTION_KEY = '__untagged__';
const UNTAGGED_SECTION_LABEL = 'Untagged';

function normalizeParam(value: string | string[] | undefined): string | null {
    if (value === undefined) return null;

    const rawValue = Array.isArray(value) ? value[0] : value;
    const normalizedValue = rawValue.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
}

function filterProductsByTag(products: readonly MyStoreProduct[], tagKey: string): MyStoreProduct[] {
    if (tagKey === UNTAGGED_SECTION_KEY) {
        return products.filter((product) => product.tags.length === 0);
    }

    const normalizedTagKey = tagKey.trim().toLowerCase();

    return products.filter((product) =>
        product.tags.some((tag) => tag.trim().toLowerCase() === normalizedTagKey)
    );
}

export default function ShopTagProductsScreen(): React.JSX.Element {
    const { uid, tag, label } = useLocalSearchParams<{ uid?: string | string[]; tag?: string | string[]; label?: string | string[] }>();
    const { theme } = useTheme();

    const shopUid = useMemo<string | null>(() => normalizeParam(uid), [uid]);
    const selectedTagKey = useMemo<string | null>(() => normalizeParam(tag), [tag]);
    const selectedTagLabel = useMemo<string | null>(() => normalizeParam(label), [label]);

    const { data: currentUser } = useCurrentUser();
    const {
        data: myStoreData,
        isLoading,
        isError,
        refetch,
    } = useMyStoreData(shopUid);

    const isOwner =
        myStoreData !== null
        && myStoreData !== undefined
        && currentUser !== null
        && currentUser !== undefined
        && myStoreData.shop.ownerUserId === currentUser.id;

    const filteredProducts = useMemo<MyStoreProduct[]>(() => {
        if (myStoreData === null || myStoreData === undefined || selectedTagKey === null) {
            return [];
        }

        return filterProductsByTag(myStoreData.products, selectedTagKey);
    }, [myStoreData, selectedTagKey]);

    const handleProductPress = (productUid: string): void => {
        router.push({
            pathname: '/home/product-details' as const,
            params: {
                uid: productUid,
                sellerView: isOwner ? 'true' : 'false',
            },
        } as Parameters<typeof router.push>[0]);
    };

    if (shopUid === null || selectedTagKey === null) {
        return (
            <SafeScreen style={styles.container} edges={SHOP_TAG_PRODUCTS_SAFE_AREA_EDGES}>
                <EmptyList
                    icon={<MaterialIcons name="local-offer" size={48} color={theme.textSecondary} />}
                    message="Tag not found"
                    submessage="The selected tag link is missing or invalid."
                />
            </SafeScreen>
        );
    }

    if (isError) {
        return (
            <SafeScreen style={styles.container} edges={SHOP_TAG_PRODUCTS_SAFE_AREA_EDGES}>
                <EmptyList
                    icon={<MaterialIcons name="error-outline" size={48} color={theme.textSecondary} />}
                    message="Unable to load products"
                    submessage="Please check your connection and try again."
                    actionButton={{
                        label: 'Retry',
                        onPress: () => {
                            void refetch();
                        },
                    }}
                />
            </SafeScreen>
        );
    }

    if (!isLoading && (myStoreData === null || myStoreData === undefined)) {
        return (
            <SafeScreen style={styles.container} edges={SHOP_TAG_PRODUCTS_SAFE_AREA_EDGES}>
                <EmptyList
                    icon={<MaterialIcons name="store-mall-directory" size={48} color={theme.textSecondary} />}
                    message="Store not found"
                    submessage="This seller store is no longer available."
                />
            </SafeScreen>
        );
    }

    const titleText = selectedTagKey === UNTAGGED_SECTION_KEY
        ? UNTAGGED_SECTION_LABEL
        : `#${selectedTagLabel ?? selectedTagKey}`;

    return (
        <SafeScreen style={styles.container} edges={SHOP_TAG_PRODUCTS_SAFE_AREA_EDGES}>
            <View style={[styles.headerContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <RipplePressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
                </RipplePressable>

                <View style={styles.headerTextContainer}>
                    <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                        {titleText}
                    </Text>
                    {isLoading ? (
                        <SkeletonLoader width={86} height={12} />
                    ) : (
                        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                        </Text>
                    )}
                </View>
            </View>

            {isLoading ? (
                <View style={styles.skeletonListWrap}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <View key={`tag-row-skeleton-${index}`} style={[styles.skeletonRow, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}> 
                            <SkeletonLoader width={112} height={112} />
                            <View style={styles.skeletonRowBody}>
                                <SkeletonLoader width="80%" height={14} style={styles.skeletonGap} />
                                <SkeletonLoader width="44%" height={13} style={styles.skeletonGap} />
                                <SkeletonLoader width="52%" height={12} />
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <StoreProductsGrid
                    products={filteredProducts}
                    onProductPress={handleProductPress}
                    layout="list"
                    emptyMessage="No products for this tag"
                    emptySubmessage="Try another tag from the Tagged tab."
                />
            )}
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    headerSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    skeletonListWrap: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    skeletonRow: {
        borderWidth: 1,
        borderRadius: 14,
        overflow: 'hidden',
        flexDirection: 'row',
        marginBottom: 12,
    },
    skeletonRowBody: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    skeletonGap: {
        marginBottom: 8,
    },
});
