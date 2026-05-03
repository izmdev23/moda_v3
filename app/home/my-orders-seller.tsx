import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyList } from '../../components/ui/empty-list';
import { RipplePressable } from '../../components/ui/ripple-pressable';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { SellerOrderedProductCard, useMarkVariantAsDelivering, useSellerOrdersData } from '../../hooks/use-orders';
import { AppAlert } from '../../utils/app-alert';
import { formatDate, formatPrice } from '../../utils/utils';

const SELLER_ORDERS_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

function getProductSelectionKey(product: SellerOrderedProductCard): string {
    return String(product.transactionId);
}

export default function MyOrdersSellerScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { data: currentUser } = useCurrentUser();
    const sellerUserId = currentUser?.id ?? null;
    const {
        data: sellerOrdersData,
        isLoading,
        isRefetching,
        refetch,
    } = useSellerOrdersData(sellerUserId);
    const markVariantAsDeliveringMutation = useMarkVariantAsDelivering();
    const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);

    useFocusEffect(
        useCallback((): void => {
            if (sellerUserId === null) {
                return;
            }

            void refetch();
        }, [sellerUserId, refetch]),
    );

    const orderedProducts = sellerOrdersData?.products ?? [];
    const pendingCount = sellerOrdersData?.overview.pendingCount ?? 0;
    const toShipCount = sellerOrdersData?.overview.toShipCount ?? 0;
    const deliveringCount = sellerOrdersData?.overview.deliveringCount ?? 0;
    const receivedCount = sellerOrdersData?.overview.receivedCount ?? 0;

    const selectedProduct = useMemo(() => {
        if (selectedProductKey === null) {
            return null;
        }

        return orderedProducts.find((product) => getProductSelectionKey(product) === selectedProductKey) ?? null;
    }, [orderedProducts, selectedProductKey]);

    const selectedVariants = useMemo(() => selectedProduct?.variants ?? [], [selectedProduct]);

    const handleMarkSentToCourier = useCallback((variantId: number | null, variantName: string): void => {
        if (variantId === null) {
            AppAlert.alert('Unavailable', 'This variant cannot be updated right now.');
            return;
        }

        AppAlert.alert(
            'Send to courier?',
            `Mark ${variantName} orders as delivering?`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Confirm',
                    onPress: () => {
                        markVariantAsDeliveringMutation.mutate(
                            { variantId },
                            {
                                onSuccess: (updatedCount) => {
                                    if (updatedCount > 0) {
                                        AppAlert.alert('Updated', `${updatedCount} item(s) were sent to courier.`);
                                        return;
                                    }

                                    AppAlert.alert('No Changes', 'No pending or confirmed orders were found for this variant.');
                                },
                                onError: (error) => {
                                    AppAlert.alert('Error', error.message);
                                },
                            },
                        );
                    },
                },
            ],
        );
    }, [markVariantAsDeliveringMutation]);

    const renderProductCard = ({ item }: { item: SellerOrderedProductCard }): React.JSX.Element => {
        const pendingProductCount = item.variants.filter(
            (variant): boolean => variant.toShipOrderCount > 0,
        ).length;
        const shippedProductCount = item.variants.filter(
            (variant): boolean => variant.deliveringOrderCount > 0 || variant.receivedOrderCount > 0,
        ).length;

        return (
            <RipplePressable
                style={[styles.productCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                onPress={() => setSelectedProductKey(getProductSelectionKey(item))}
                activeOpacity={0.85}
            >
                {item.thumbnailUrl.length > 0 ? (
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.productImage} contentFit="cover" />
                ) : (
                    <View style={[styles.productImageFallback, { backgroundColor: theme.background }]}>
                        <MaterialIcons name="inventory-2" size={28} color={theme.textSecondary} />
                    </View>
                )}

                <View style={styles.productBody}>
                    <Text style={[styles.productTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                        {item.productName}
                    </Text>

                    <View style={styles.productStatusChipsRow}>
                        {pendingProductCount > 0 && (
                            <View style={[styles.productStatusChip, { backgroundColor: theme.warning }]}>
                                <Text style={[styles.productStatusChipText, { color: theme.white }]}>
                                    {pendingProductCount} Pending
                                </Text>
                            </View>
                        )}

                        {shippedProductCount > 0 && (
                            <View style={[styles.productStatusChip, { backgroundColor: theme.success }]}>
                                <Text style={[styles.productStatusChipText, { color: theme.white }]}>
                                    {shippedProductCount} Shipped
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.productMetaRow}>
                        <Text style={[styles.productMetaText, { color: theme.textSecondary }]}>Txn #{item.transactionId}</Text>
                        <Text style={[styles.productMetaText, { color: theme.textSecondary }]}>Products: {item.productCount}</Text>
                    </View>

                    <View style={styles.productMetaRow}>
                        <Text style={[styles.productMetaText, { color: theme.textSecondary }]}>Qty: {item.totalOrderedQuantity}</Text>
                    </View>

                    <View style={styles.productMetaRow}>
                        <Text style={[styles.productAmountText, { color: theme.primary }]}>{formatPrice(item.totalSalesAmount)}</Text>
                        <Text style={[styles.productMetaText, { color: theme.textSecondary }]}>{formatDate(item.latestOrderAt)}</Text>
                    </View>
                </View>
            </RipplePressable>
        );
    };

    return (
        <SafeScreen style={styles.container} edges={SELLER_ORDERS_SAFE_AREA_EDGES}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <View style={styles.headerTopRow}>
                    <Text style={[styles.headerText, { color: theme.textPrimary }]}>Customer Orders</Text>
                    <RipplePressable
                        style={[styles.refundRequestsButton, { borderColor: theme.primary }]}
                        onPress={() => router.push('/home/refund-requests-seller' as Parameters<typeof router.push>[0])}
                    >
                        <Text style={[styles.refundRequestsButtonText, { color: theme.primary }]}>Refund Requests</Text>
                    </RipplePressable>
                </View>
                <Text style={[styles.headerSubtext, { color: theme.textSecondary }]}> 
                    Pending: {pendingCount} • To Ship: {toShipCount} • Delivering: {deliveringCount} • Received: {receivedCount}
                </Text>
            </View>

            <FlatList
                data={orderedProducts}
                keyExtractor={(item) => String(item.transactionId)}
                contentContainerStyle={styles.listContent}
                renderItem={renderProductCard}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={() => { void refetch(); }}
                        tintColor={theme.primary}
                    />
                }
                ListEmptyComponent={
                    isLoading
                        ? <View style={styles.loadingPlaceholder} />
                        : (
                            <EmptyList
                                icon={<MaterialIcons name="inventory" size={48} color={theme.textSecondary} />}
                                message="No order activity yet"
                                submessage="New orders for your products will appear here."
                            />
                        )
                }
            />

            <Modal
                visible={selectedProduct !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedProductKey(null)}
            >
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalCard,
                            {
                                backgroundColor: theme.cardBackground,
                                paddingBottom: Math.max(12, insets.bottom + 8),
                            },
                        ]}
                    >
                        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                                {selectedProduct?.productName ?? 'Transaction Items'}
                            </Text>
                            <RipplePressable onPress={() => setSelectedProductKey(null)}>
                                <MaterialIcons name="close" size={24} color={theme.textPrimary} />
                            </RipplePressable>
                        </View>

                        <FlatList
                            data={selectedVariants}
                            keyExtractor={(item) => `${item.variantId ?? item.variantName}`}
                            contentContainerStyle={styles.variantListContent}
                            renderItem={({ item }) => (
                                <View style={[styles.variantRow, { borderBottomColor: theme.border }]}>
                                    <View style={styles.variantInfoColumn}>
                                        <Text style={[styles.variantTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                                            {item.variantName}
                                        </Text>
                                        <Text style={[styles.variantMetaText, { color: theme.textSecondary }]}>Quantity: {item.quantity}</Text>
                                        <Text style={[styles.variantMetaText, { color: theme.textSecondary }]}>To Ship: {item.toShipOrderCount}</Text>
                                        <Text style={[styles.variantMetaText, { color: theme.textSecondary }]}>Delivering: {item.deliveringOrderCount}</Text>
                                        <Text style={[styles.variantMetaText, { color: theme.textSecondary }]}>Received: {item.receivedOrderCount}</Text>
                                    </View>

                                    <View style={styles.variantAmountColumn}>
                                        <Text style={[styles.variantMetaText, { color: theme.textSecondary }]}>Price: {formatPrice(item.unitPrice)}</Text>
                                        <Text style={[styles.variantTotalText, { color: theme.primary }]}>Total: {formatPrice(item.totalPrice)}</Text>
                                        {(item.deliveringOrderCount > 0 || item.receivedOrderCount > 0) && (
                                            <View style={[styles.shippedIndicator, { backgroundColor: theme.success }]}>
                                                <Text style={[styles.shippedIndicatorText, { color: theme.white }]}>Shipped</Text>
                                            </View>
                                        )}
                                        {item.toShipOrderCount > 0 && (
                                            <RipplePressable
                                                style={[
                                                    styles.sentToCourierButton,
                                                    {
                                                        backgroundColor: theme.primary,
                                                        opacity: markVariantAsDeliveringMutation.isPending ? 0.7 : 1,
                                                    },
                                                ]}
                                                onPress={() => handleMarkSentToCourier(item.variantId, item.variantName)}
                                                disabled={markVariantAsDeliveringMutation.isPending}
                                            >
                                                <Text style={styles.sentToCourierButtonText}>Send to Courier</Text>
                                            </RipplePressable>
                                        )}
                                    </View>
                                </View>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
    },
    headerText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerSubtext: {
        fontSize: 12,
        marginTop: 4,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
    refundRequestsButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    refundRequestsButtonText: {
        fontSize: 12,
        fontWeight: '700',
    },
    },
    productCard: {
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    productImage: {
        width: 84,
        height: 84,
        borderRadius: 10,
    },
    productImageFallback: {
        width: 84,
        height: 84,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    productBody: {
        flex: 1,
        justifyContent: 'center',
        gap: 6,
    },
    productTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    productStatusChipsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    productStatusChip: {
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    productStatusChipText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    productMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    productMetaText: {
        fontSize: 12,
        fontWeight: '600',
    },
    productAmountText: {
        fontSize: 14,
        fontWeight: '700',
    },
    loadingPlaceholder: {
        height: 12,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalCard: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '72%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        flex: 1,
    },
    variantListContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    variantRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingVertical: 12,
    },
    variantInfoColumn: {
        flex: 1,
        paddingRight: 12,
        gap: 4,
    },
    variantAmountColumn: {
        alignItems: 'flex-end',
        gap: 4,
    },
    variantTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    variantMetaText: {
        fontSize: 12,
    },
    variantTotalText: {
        fontSize: 13,
        fontWeight: '700',
    },
    sentToCourierButton: {
        marginTop: 6,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    sentToCourierButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    shippedIndicator: {
        marginTop: 6,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    shippedIndicatorText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
});
