import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DeliveryTimer, OrderStatus, OrderStatusBadge } from '../../components/my-orders-components';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { supabase } from '../../supabase/supabaseClient';

interface OrderItemLookupRow {
    readonly order_id: number;
    readonly shop_id: number | null;
    readonly product_name: string;
    readonly unit_price: number;
    readonly seller_shipping_status: string;
}

interface OrderLookupRow {
    readonly status: string;
    readonly delivery_deadline: string | null;
    readonly address_id: number;
}

interface ShopLookupRow {
    readonly country: string;
    readonly province: string;
    readonly city: string;
    readonly address_detail: string;
}

interface DeliveryAddressLookupRow {
    readonly country: string;
    readonly province: string;
    readonly city: string;
    readonly barangay: string;
    readonly address_detail: string;
}

interface RefundRequestDetailsRow {
    readonly status: string;
    readonly reason: string;
    readonly evidence_image_urls: readonly string[];
}

type RefundDisplayStatus = 'pending' | 'accepted' | 'rejected';

interface RefundDetails {
    readonly status: RefundDisplayStatus;
    readonly message: string;
    readonly evidenceImageUrls: readonly string[];
}

interface ProductDeliveryDetails {
    readonly title: string;
    readonly price: number;
    readonly origin: string;
    readonly destination: string;
    readonly status: OrderStatus;
    readonly deadline?: Date;
    readonly refundDetails: RefundDetails | null;
}

const UNAVAILABLE_LOCATION_TEXT = 'Unavailable location';
const NO_SAVED_LOCATION_TEXT = 'No saved location';
const TRACKING_NUMBER_FALLBACK = 'JT123456789PH';

function normalizeOrderStatus(rawStatus: string): OrderStatus {
    const normalizedStatus = rawStatus.trim().toLowerCase();

    if (normalizedStatus === 'shipped') return 'shipped';
    if (normalizedStatus === 'delivered') return 'delivered';
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') return 'cancelled';

    // Buyer display rule: keep confirmed under pending until seller sends to courier.
    return 'pending';
}

function normalizeSellerShippingStatus(rawStatus: string): 'pending' | 'shipped' | 'delivered' {
    const normalizedStatus = rawStatus.trim().toLowerCase();

    if (normalizedStatus === 'delivered') {
        return 'delivered';
    }

    if (normalizedStatus === 'shipped') {
        return 'shipped';
    }

    return 'pending';
}

function resolveBuyerItemStatus(orderStatus: string, sellerShippingStatus: string): OrderStatus {
    const normalizedOrderStatus = normalizeOrderStatus(orderStatus);
    const normalizedShippingStatus = normalizeSellerShippingStatus(sellerShippingStatus);

    if (normalizedOrderStatus === 'delivered' || normalizedOrderStatus === 'cancelled') {
        return normalizedOrderStatus;
    }

    if (normalizedShippingStatus === 'delivered') {
        return 'delivered';
    }

    if (normalizedShippingStatus === 'shipped' || normalizedOrderStatus === 'shipped') {
        return 'shipped';
    }

    return normalizedOrderStatus;
}

function toRefundDisplayStatus(rawStatus: string): RefundDisplayStatus {
    const normalizedStatus = rawStatus.trim().toLowerCase();

    if (normalizedStatus === 'accepted') {
        return 'accepted';
    }

    if (normalizedStatus === 'rejected') {
        return 'rejected';
    }

    return 'pending';
}

function getRefundStatusStyles(
    refundStatus: RefundDisplayStatus,
    theme: ReturnType<typeof useTheme>['theme'],
): { readonly label: string; readonly color: string; readonly backgroundColor: string } {
    if (refundStatus === 'accepted') {
        return {
            label: 'Refunded',
            color: theme.success,
            backgroundColor: `${theme.success}20`,
        };
    }

    if (refundStatus === 'rejected') {
        return {
            label: 'Declined',
            color: theme.error,
            backgroundColor: `${theme.error}20`,
        };
    }

    return {
        label: 'Pending',
        color: theme.warning,
        backgroundColor: `${theme.warning}20`,
    };
}

function formatAddress(parts: readonly string[]): string {
    const resolvedParts = parts
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

    if (resolvedParts.length === 0) {
        return NO_SAVED_LOCATION_TEXT;
    }

    return resolvedParts.join(', ');
}

async function fetchProductDeliveryDetails(orderItemUid: string): Promise<ProductDeliveryDetails | null> {
    const { data: orderItemData, error: orderItemError } = await supabase
        .from('order_items')
        .select('order_id, shop_id, product_name, unit_price, seller_shipping_status')
        .eq('uid', orderItemUid)
        .maybeSingle();

    if (orderItemError !== null) {
        throw new Error(orderItemError.message);
    }

    if (orderItemData === null) {
        return null;
    }

    const orderItem = orderItemData as OrderItemLookupRow;

    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('status, delivery_deadline, address_id')
        .eq('id', orderItem.order_id)
        .maybeSingle();

    if (orderError !== null) {
        throw new Error(orderError.message);
    }

    if (orderData === null) {
        return null;
    }

    const order = orderData as OrderLookupRow;

    const shopPromise = orderItem.shop_id === null
        ? Promise.resolve({ data: null as ShopLookupRow | null, error: null })
        : supabase
            .from('shops')
            .select('country, province, city, address_detail')
            .eq('id', orderItem.shop_id)
            .is('deleted_at', null)
            .maybeSingle();

    const addressPromise = supabase
        .from('addresses')
        .select('country, province, city, barangay, address_detail')
        .eq('id', order.address_id)
        .maybeSingle();

    const [shopResult, addressResult] = await Promise.all([shopPromise, addressPromise]);

    if (shopResult.error !== null) {
        throw new Error(shopResult.error.message);
    }

    if (addressResult.error !== null) {
        throw new Error(addressResult.error.message);
    }

    const shopLocation = shopResult.data as ShopLookupRow | null;
    const deliveryAddress = addressResult.data as DeliveryAddressLookupRow | null;

    const originAddress = shopLocation === null
        ? NO_SAVED_LOCATION_TEXT
        : formatAddress([
            shopLocation.address_detail,
            shopLocation.city,
            shopLocation.province,
            shopLocation.country,
        ]);

    const destinationAddress = deliveryAddress === null
        ? NO_SAVED_LOCATION_TEXT
        : formatAddress([
            deliveryAddress.address_detail,
            deliveryAddress.barangay,
            deliveryAddress.city,
            deliveryAddress.province,
            deliveryAddress.country,
        ]);

    const { data: refundRequestData, error: refundRequestError } = await supabase
        .from('refund_requests')
        .select('status, reason, evidence_image_urls')
        .eq('order_item_uid', orderItemUid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (refundRequestError !== null) {
        throw new Error(refundRequestError.message);
    }

    const refundRequest = refundRequestData as RefundRequestDetailsRow | null;
    const refundDetails: RefundDetails | null = refundRequest === null
        ? null
        : {
            status: toRefundDisplayStatus(refundRequest.status),
            message: refundRequest.reason,
            evidenceImageUrls: refundRequest.evidence_image_urls,
        };

    return {
        title: orderItem.product_name,
        price: orderItem.unit_price,
        origin: originAddress,
        destination: destinationAddress,
        status: resolveBuyerItemStatus(order.status, orderItem.seller_shipping_status),
        deadline: order.delivery_deadline === null ? undefined : new Date(order.delivery_deadline),
        refundDetails,
    };
}

export default function ProductDeliveryInfoScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { orderId } = useLocalSearchParams();

    const normalizedOrderItemUid = typeof orderId === 'string' ? orderId : '';

    const { data: orderDetails, isLoading, isError } = useQuery<ProductDeliveryDetails | null>({
        queryKey: ['product-delivery-info', normalizedOrderItemUid],
        queryFn: () => fetchProductDeliveryDetails(normalizedOrderItemUid),
        enabled: normalizedOrderItemUid.length > 0,
    });

    if (isLoading) {
        return (
            <SafeScreen style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}> 
                        <SkeletonLoader width="70%" height={24} style={styles.skeletonGap} />
                        <SkeletonLoader width="35%" height={30} style={styles.skeletonGap} />
                        <View style={styles.statusRow}>
                            <SkeletonLoader width={88} height={26} borderRadius={999} />
                            <SkeletonLoader width={120} height={18} />
                        </View>
                    </View>

                    <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}> 
                        <SkeletonLoader width="42%" height={20} style={styles.skeletonGap} />
                        <View style={styles.routeItem}>
                            <SkeletonLoader width={24} height={24} borderRadius={12} />
                            <View style={styles.routeDetails}>
                                <SkeletonLoader width="40%" height={14} style={styles.skeletonGapSmall} />
                                <SkeletonLoader width="92%" height={14} />
                            </View>
                        </View>

                        <View style={[styles.routeLine, { borderLeftColor: theme.border }]} />

                        <View style={styles.routeItem}>
                            <SkeletonLoader width={24} height={24} borderRadius={12} />
                            <View style={styles.routeDetails}>
                                <SkeletonLoader width="44%" height={14} style={styles.skeletonGapSmall} />
                                <SkeletonLoader width="88%" height={14} />
                            </View>
                        </View>
                    </View>

                    <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}> 
                        <SkeletonLoader width="52%" height={20} style={styles.skeletonGap} />
                        <SkeletonLoader width="58%" height={14} style={styles.skeletonGapSmall} />
                        <SkeletonLoader width="66%" height={14} />
                    </View>
                </ScrollView>
            </SafeScreen>
        );
    }

    const fallbackDetails: ProductDeliveryDetails = {
        title: 'Order Item',
        price: 0,
        origin: isError ? UNAVAILABLE_LOCATION_TEXT : NO_SAVED_LOCATION_TEXT,
        destination: isError ? UNAVAILABLE_LOCATION_TEXT : NO_SAVED_LOCATION_TEXT,
        status: 'pending',
        refundDetails: null,
    };

    const resolvedDetails = orderDetails ?? fallbackDetails;
    const refundDetails = resolvedDetails.refundDetails;
    const hasRefundDetails = refundDetails !== null;
    const refundStatusStyles = hasRefundDetails ? getRefundStatusStyles(refundDetails.status, theme) : null;

    return (
        <SafeScreen style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Header */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    <Text style={[styles.title, { color: theme.textPrimary }]}>{resolvedDetails.title}</Text>
                    <Text style={[styles.price, { color: theme.primary }]}>₱{resolvedDetails.price.toFixed(2)}</Text>
                    <View style={styles.statusRow}>
                        <OrderStatusBadge status={resolvedDetails.status} />
                        <DeliveryTimer status={resolvedDetails.status} deadline={resolvedDetails.deadline} />
                    </View>
                </View>

                {hasRefundDetails ? (
                    <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Refund Details</Text>

                        {refundStatusStyles !== null && (
                            <View style={[styles.refundStatusChip, { backgroundColor: refundStatusStyles.backgroundColor }]}> 
                                <Text style={[styles.refundStatusText, { color: refundStatusStyles.color }]}>{refundStatusStyles.label}</Text>
                            </View>
                        )}

                        <View style={[styles.refundMessageBox, { borderColor: theme.border, backgroundColor: theme.background }]}> 
                            <Text style={[styles.refundMessageLabel, { color: theme.textSecondary }]}>Your Message</Text>
                            <Text style={[styles.refundMessageValue, { color: theme.textPrimary }]}>{refundDetails.message}</Text>
                        </View>

                        {refundDetails.evidenceImageUrls.length > 0 && (
                            <FlatList
                                horizontal
                                data={refundDetails.evidenceImageUrls}
                                keyExtractor={(imageUrl) => imageUrl}
                                style={styles.imagesList}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.imagesListContent}
                                renderItem={({ item: imageUrl }) => (
                                    <Image source={{ uri: imageUrl }} style={styles.evidenceImage} contentFit="cover" />
                                )}
                            />
                        )}
                    </View>
                ) : (
                    <>
                        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Delivery Route</Text>

                            <View style={styles.routeItem}>
                                <MaterialIcons name="store" size={24} color={theme.textSecondary} />
                                <View style={styles.routeDetails}>
                                    <Text style={[styles.routeLabel, { color: theme.textPrimary }]}>Origin (Seller)</Text>
                                    <Text style={[styles.routeAddress, { color: theme.textSecondary }]}>{resolvedDetails.origin}</Text>
                                </View>
                            </View>

                            <View style={[styles.routeLine, { borderLeftColor: theme.border }]} />

                            <View style={styles.routeItem}>
                                <MaterialIcons name="home" size={24} color={theme.primary} />
                                <View style={styles.routeDetails}>
                                    <Text style={[styles.routeLabel, { color: theme.primary }]}>Destination (You)</Text>
                                    <Text style={[styles.routeAddress, { color: theme.textSecondary }]}>{resolvedDetails.destination}</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Tracking Information</Text>
                            <Text style={[styles.trackingText, { color: theme.textSecondary }]}>Courier: J&T Express</Text>
                            <Text style={[styles.trackingText, { color: theme.textSecondary }]}>Tracking Number: {orderId || TRACKING_NUMBER_FALLBACK}</Text>
                        </View>
                    </>
                )}

            </ScrollView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    section: {
        padding: 16,
        borderBottomWidth: 1,
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    price: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    routeItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    routeDetails: {
        flex: 1,
    },
    routeLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    routeAddress: {
        fontSize: 13,
        lineHeight: 18,
    },
    routeLine: {
        height: 40,
        borderLeftWidth: 2,
        marginLeft: 11,
        marginVertical: 4,
    },
    trackingText: {
        fontSize: 14,
        marginBottom: 8,
    },
    skeletonGap: {
        marginBottom: 12,
    },
    skeletonGapSmall: {
        marginBottom: 8,
    },
    refundStatusChip: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        marginBottom: 14,
    },
    refundStatusText: {
        fontSize: 12,
        fontWeight: '700',
    },
    refundMessageBox: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
    },
    refundMessageLabel: {
        fontSize: 12,
        marginBottom: 6,
    },
    refundMessageValue: {
        fontSize: 14,
        lineHeight: 20,
    },
    imagesList: {
        marginTop: 14,
    },
    imagesListContent: {
        gap: 8,
        paddingRight: 8,
    },
    evidenceImage: {
        width: 100,
        height: 100,
        borderRadius: 10,
    },
});
