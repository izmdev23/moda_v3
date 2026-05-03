import { UseMutationResult, UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '../supabase/database.types';
import { supabase } from '../supabase/supabaseClient';
import { queryKeys } from '../utils/query-keys';

export type OrderDisplayStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

interface BuyerOrderRow {
    readonly id: number;
    readonly uid: string;
    readonly status: string;
    readonly delivery_deadline: string | null;
    readonly created_at: string;
}

interface BuyerOrderItemRow {
    readonly uid: string;
    readonly order_id: number;
    readonly product_id: number | null;
    readonly shop_id: number | null;
    readonly product_name: string;
    readonly variant_name: string;
    readonly quantity: number;
    readonly unit_price: number;
    readonly total_price: number;
}

interface ProductThumbnailRow {
    readonly id: number;
    readonly thumbnail_url: string;
}

interface ShopNameRow {
    readonly id: number;
    readonly shop_name: string;
}

interface SellerOrderRow {
    readonly id: number;
    readonly uid: string;
    readonly status: string;
    readonly created_at: string;
}

interface SellerOrderItemRow {
    readonly order_id: number;
    readonly product_id: number | null;
    readonly variant_id: number | null;
    readonly product_name: string;
    readonly variant_name: string;
    readonly quantity: number;
    readonly unit_price: number;
    readonly total_price: number;
}

interface SellerProductRow {
    readonly id: number;
    readonly uid: string;
    readonly name: string;
    readonly thumbnail_url: string;
}

interface SellerOrderOverview {
    readonly pendingCount: number;
    readonly toShipCount: number;
    readonly deliveringCount: number;
    readonly receivedCount: number;
}

interface SellerVariantAccumulator {
    readonly variantId: number | null;
    readonly variantName: string;
    quantity: number;
    totalPrice: number;
    unitPrice: number;
    readonly toShipOrderIds: Set<number>;
    readonly deliveringOrderIds: Set<number>;
    readonly receivedOrderIds: Set<number>;
}

interface SellerProductAccumulator {
    readonly productId: number | null;
    productUid: string | null;
    productName: string;
    thumbnailUrl: string;
    totalOrderedQuantity: number;
    totalSalesAmount: number;
    latestOrderAt: string;
    orderIdSet: Set<number>;
    variantMap: Map<string, SellerVariantAccumulator>;
}

export interface BuyerOrderCardItem {
    readonly id: string;
    readonly orderUid: string;
    readonly name: string;
    readonly thumbnail: string;
    readonly quantity: number;
    readonly price: number;
    readonly status: OrderDisplayStatus;
    readonly deadline?: Date;
    readonly shopName: string;
    readonly variantName: string;
    readonly totalPrice: number;
    readonly createdAt: string;
}

export interface SellerOrderVariantSummary {
    readonly variantId: number | null;
    readonly variantName: string;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly totalPrice: number;
    readonly toShipOrderCount: number;
    readonly deliveringOrderCount: number;
    readonly receivedOrderCount: number;
}

export interface SellerOrderedProductCard {
    readonly productId: number | null;
    readonly productUid: string | null;
    readonly productName: string;
    readonly thumbnailUrl: string;
    readonly totalOrderedQuantity: number;
    readonly totalSalesAmount: number;
    readonly orderCount: number;
    readonly latestOrderAt: string;
    readonly variants: readonly SellerOrderVariantSummary[];
}

export interface SellerOrdersData {
    readonly shopUid: string;
    readonly overview: SellerOrderOverview;
    readonly products: readonly SellerOrderedProductCard[];
}

const EMPTY_IMAGE_URL = '';
const UNKNOWN_SHOP_NAME = 'Unknown Shop';
const ACTIVE_ORDER_STATUSES: readonly OrderDisplayStatus[] = ['pending', 'confirmed', 'shipped', 'delivered'];

function normalizeOrderStatus(rawStatus: string): OrderDisplayStatus {
    const normalized = rawStatus.trim().toLowerCase();

    if (normalized === 'confirmed') return 'confirmed';
    if (normalized === 'shipped') return 'shipped';
    if (normalized === 'delivered') return 'delivered';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';

    return 'pending';
}

function toBuyerDisplayStatus(rawStatus: string): OrderDisplayStatus {
    const normalizedStatus = normalizeOrderStatus(rawStatus);

    if (normalizedStatus === 'confirmed') {
        return 'pending';
    }

    return normalizedStatus;
}

async function fetchBuyerOrders(userId: number): Promise<BuyerOrderCardItem[]> {
    const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, uid, status, delivery_deadline, created_at')
        .eq('buyer_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (ordersError !== null) {
        throw new Error(ordersError.message);
    }

    const orders = (ordersData ?? []) as BuyerOrderRow[];
    if (orders.length === 0) {
        return [];
    }

    const orderById = new Map<number, BuyerOrderRow>();
    for (const order of orders) {
        orderById.set(order.id, order);
    }

    const orderIds = orders.map((order) => order.id);

    const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('uid, order_id, product_id, shop_id, product_name, variant_name, quantity, unit_price, total_price')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

    if (orderItemsError !== null) {
        throw new Error(orderItemsError.message);
    }

    const orderItems = (orderItemsData ?? []) as BuyerOrderItemRow[];
    if (orderItems.length === 0) {
        return [];
    }

    const uniqueProductIds = Array.from(
        new Set(orderItems.map((item) => item.product_id).filter((value): value is number => value !== null)),
    );
    const uniqueShopIds = Array.from(
        new Set(orderItems.map((item) => item.shop_id).filter((value): value is number => value !== null)),
    );

    const productsPromise = uniqueProductIds.length > 0
        ? supabase.from('products').select('id, thumbnail_url').in('id', uniqueProductIds)
        : Promise.resolve({ data: [] as ProductThumbnailRow[], error: null });
    const shopsPromise = uniqueShopIds.length > 0
        ? supabase.from('shops').select('id, shop_name').in('id', uniqueShopIds)
        : Promise.resolve({ data: [] as ShopNameRow[], error: null });

    const [productsResult, shopsResult] = await Promise.all([productsPromise, shopsPromise]);

    if (productsResult.error !== null) {
        throw new Error(productsResult.error.message);
    }

    if (shopsResult.error !== null) {
        throw new Error(shopsResult.error.message);
    }

    const productImageById = new Map<number, string>();
    for (const product of (productsResult.data ?? []) as ProductThumbnailRow[]) {
        productImageById.set(product.id, product.thumbnail_url ?? EMPTY_IMAGE_URL);
    }

    const shopNameById = new Map<number, string>();
    for (const shop of (shopsResult.data ?? []) as ShopNameRow[]) {
        shopNameById.set(shop.id, shop.shop_name);
    }

    return orderItems
        .map((item) => {
            const order = orderById.get(item.order_id);
            if (order === undefined) {
                return null;
            }

            return {
                id: item.uid,
                orderUid: order.uid,
                name: item.product_name,
                thumbnail: item.product_id === null ? EMPTY_IMAGE_URL : (productImageById.get(item.product_id) ?? EMPTY_IMAGE_URL),
                quantity: item.quantity,
                price: item.unit_price,
                status: toBuyerDisplayStatus(order.status),
                deadline: order.delivery_deadline === null ? undefined : new Date(order.delivery_deadline),
                shopName: item.shop_id === null ? UNKNOWN_SHOP_NAME : (shopNameById.get(item.shop_id) ?? UNKNOWN_SHOP_NAME),
                variantName: item.variant_name,
                totalPrice: item.total_price,
                createdAt: order.created_at,
            } as BuyerOrderCardItem;
        })
        .filter((item): item is BuyerOrderCardItem => item !== null)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

async function fetchSellerOrdersData(sellerUserId: number): Promise<SellerOrdersData | null> {
    const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('id, uid')
        .eq('user_id', sellerUserId)
        .is('deleted_at', null)
        .maybeSingle();

    if (shopError !== null) {
        throw new Error(shopError.message);
    }

    if (shopData === null) {
        return null;
    }

    const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('order_id, product_id, variant_id, product_name, variant_name, quantity, unit_price, total_price')
        .eq('shop_id', shopData.id)
        .order('created_at', { ascending: false });

    if (orderItemsError !== null) {
        throw new Error(orderItemsError.message);
    }

    const orderItems = (orderItemsData ?? []) as SellerOrderItemRow[];
    if (orderItems.length === 0) {
        return {
            shopUid: shopData.uid,
            overview: {
                pendingCount: 0,
                toShipCount: 0,
                deliveringCount: 0,
                receivedCount: 0,
            },
            products: [],
        };
    }

    const orderIds = Array.from(new Set(orderItems.map((item) => item.order_id)));

    const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, uid, status, created_at')
        .in('id', orderIds);

    if (ordersError !== null) {
        throw new Error(ordersError.message);
    }

    const orders = (ordersData ?? []) as SellerOrderRow[];
    const orderById = new Map<number, SellerOrderRow>();

    let pendingCount = 0;
    let toShipCount = 0;
    let deliveringCount = 0;
    let receivedCount = 0;

    for (const order of orders) {
        const normalizedStatus = normalizeOrderStatus(order.status);
        orderById.set(order.id, order);

        if (normalizedStatus === 'pending') {
            pendingCount += 1;
        }
        if (normalizedStatus === 'confirmed') {
            toShipCount += 1;
        }
        if (normalizedStatus === 'shipped') {
            deliveringCount += 1;
        }
        if (normalizedStatus === 'delivered') {
            receivedCount += 1;
        }
    }

    const filteredItems = orderItems.filter((item) => {
        const order = orderById.get(item.order_id);
        if (order === undefined) {
            return false;
        }

        const normalizedStatus = normalizeOrderStatus(order.status);
        return ACTIVE_ORDER_STATUSES.includes(normalizedStatus);
    });

    if (filteredItems.length === 0) {
        return {
            shopUid: shopData.uid,
            overview: {
                pendingCount,
                toShipCount,
                deliveringCount,
                receivedCount,
            },
            products: [],
        };
    }

    const productIds = Array.from(
        new Set(filteredItems.map((item) => item.product_id).filter((value): value is number => value !== null)),
    );

    const productsResult = productIds.length > 0
        ? await supabase.from('products').select('id, uid, name, thumbnail_url').in('id', productIds)
        : { data: [] as SellerProductRow[], error: null };

    if (productsResult.error !== null) {
        throw new Error(productsResult.error.message);
    }

    const productById = new Map<number, SellerProductRow>();
    for (const product of (productsResult.data ?? []) as SellerProductRow[]) {
        productById.set(product.id, product);
    }

    const groupedProducts = new Map<string, SellerProductAccumulator>();

    for (const item of filteredItems) {
        const order = orderById.get(item.order_id);
        if (order === undefined) {
            continue;
        }

        const productKey = item.product_id === null ? `missing-${item.product_name}` : String(item.product_id);
        const mappedProduct = item.product_id === null ? undefined : productById.get(item.product_id);

        let accumulator = groupedProducts.get(productKey);
        if (accumulator === undefined) {
            accumulator = {
                productId: item.product_id,
                productUid: mappedProduct?.uid ?? null,
                productName: mappedProduct?.name ?? item.product_name,
                thumbnailUrl: mappedProduct?.thumbnail_url ?? EMPTY_IMAGE_URL,
                totalOrderedQuantity: 0,
                totalSalesAmount: 0,
                latestOrderAt: order.created_at,
                orderIdSet: new Set<number>(),
                variantMap: new Map<string, SellerVariantAccumulator>(),
            };
            groupedProducts.set(productKey, accumulator);
        }

        accumulator.totalOrderedQuantity += item.quantity;
        accumulator.totalSalesAmount += item.total_price;
        accumulator.orderIdSet.add(item.order_id);

        if (new Date(order.created_at).getTime() > new Date(accumulator.latestOrderAt).getTime()) {
            accumulator.latestOrderAt = order.created_at;
        }

        const variantKey = item.variant_id === null ? `missing-${item.variant_name}` : String(item.variant_id);
        const existingVariant = accumulator.variantMap.get(variantKey);

        if (existingVariant === undefined) {
            const createdVariant: SellerVariantAccumulator = {
                variantId: item.variant_id,
                variantName: item.variant_name,
                quantity: item.quantity,
                totalPrice: item.total_price,
                unitPrice: item.unit_price,
                toShipOrderIds: new Set<number>(),
                deliveringOrderIds: new Set<number>(),
                receivedOrderIds: new Set<number>(),
            };

            const normalizedStatus = normalizeOrderStatus(order.status);
            if (normalizedStatus === 'pending' || normalizedStatus === 'confirmed') {
                createdVariant.toShipOrderIds.add(item.order_id);
            }
            if (normalizedStatus === 'shipped') {
                createdVariant.deliveringOrderIds.add(item.order_id);
            }
            if (normalizedStatus === 'delivered') {
                createdVariant.receivedOrderIds.add(item.order_id);
            }

            accumulator.variantMap.set(variantKey, createdVariant);
            continue;
        }

        existingVariant.quantity += item.quantity;
        existingVariant.totalPrice += item.total_price;

        const normalizedStatus = normalizeOrderStatus(order.status);
        if (normalizedStatus === 'pending' || normalizedStatus === 'confirmed') {
            existingVariant.toShipOrderIds.add(item.order_id);
        }
        if (normalizedStatus === 'shipped') {
            existingVariant.deliveringOrderIds.add(item.order_id);
        }
        if (normalizedStatus === 'delivered') {
            existingVariant.receivedOrderIds.add(item.order_id);
        }
    }

    const products: SellerOrderedProductCard[] = Array.from(groupedProducts.values())
        .map((accumulator) => ({
            productId: accumulator.productId,
            productUid: accumulator.productUid,
            productName: accumulator.productName,
            thumbnailUrl: accumulator.thumbnailUrl,
            totalOrderedQuantity: accumulator.totalOrderedQuantity,
            totalSalesAmount: accumulator.totalSalesAmount,
            orderCount: accumulator.orderIdSet.size,
            latestOrderAt: accumulator.latestOrderAt,
            variants: Array.from(accumulator.variantMap.values())
                .map((variant) => ({
                    variantId: variant.variantId,
                    variantName: variant.variantName,
                    quantity: variant.quantity,
                    unitPrice: variant.unitPrice,
                    totalPrice: variant.totalPrice,
                    toShipOrderCount: variant.toShipOrderIds.size,
                    deliveringOrderCount: variant.deliveringOrderIds.size,
                    receivedOrderCount: variant.receivedOrderIds.size,
                }))
                .sort((left, right) => right.quantity - left.quantity),
        }))
        .sort((left, right) => new Date(right.latestOrderAt).getTime() - new Date(left.latestOrderAt).getTime());

    return {
        shopUid: shopData.uid,
        overview: {
            pendingCount,
            toShipCount,
            deliveringCount,
            receivedCount,
        },
        products,
    };
}

export function useBuyerOrders(userId: number | null): UseQueryResult<readonly BuyerOrderCardItem[], Error> {
    return useQuery<readonly BuyerOrderCardItem[]>({
        queryKey: queryKeys.orders.byBuyer(userId ?? 0),
        queryFn: () => fetchBuyerOrders(userId ?? 0),
        enabled: userId !== null,
        staleTime: 30 * 1000,
    });
}

export function useSellerOrdersData(sellerUserId: number | null): UseQueryResult<SellerOrdersData | null, Error> {
    return useQuery<SellerOrdersData | null>({
        queryKey: queryKeys.orders.bySeller(sellerUserId ?? 0),
        queryFn: () => fetchSellerOrdersData(sellerUserId ?? 0),
        enabled: sellerUserId !== null,
        staleTime: 30 * 1000,
    });
}

export function useMarkOrderReceived(): UseMutationResult<boolean, Error, { readonly orderUid: string }> {
    const queryClient = useQueryClient();

    return useMutation<boolean, Error, { readonly orderUid: string }>({
        mutationFn: async ({ orderUid }) => {
            const { data, error } = await supabase.rpc('mark_order_received', {
                p_order_uid: orderUid,
            });

            if (error !== null) {
                throw new Error(error.message);
            }

            if (data !== true) {
                throw new Error('Unable to mark this order as received.');
            }

            return true;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
            void queryClient.invalidateQueries({ queryKey: ['products'] });
            void queryClient.invalidateQueries({ queryKey: ['shop-analytics'] });
        },
    });
}

export function useMarkVariantAsDelivering(): UseMutationResult<number, Error, { readonly variantId: number }> {
    const queryClient = useQueryClient();

    return useMutation<number, Error, { readonly variantId: number }>({
        mutationFn: async ({ variantId }) => {
            const { data, error } = await supabase.rpc('mark_variant_orders_shipped', {
                p_variant_id: variantId,
            });

            if (error !== null) {
                throw new Error(error.message);
            }

            if (typeof data !== 'number') {
                throw new Error('Unable to update variant delivery state.');
            }

            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
            void queryClient.invalidateQueries({ queryKey: ['products'] });
            void queryClient.invalidateQueries({ queryKey: ['shop-analytics'] });
        },
    });
}

export type OrdersRow = Tables<'orders'>;