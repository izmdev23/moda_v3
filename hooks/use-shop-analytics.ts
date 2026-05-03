import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase/supabaseClient';

const DAILY_TREND_WINDOW_DAYS = 14;
const QUERY_BATCH_SIZE = 200;
const ANALYTICS_QUERY_STALE_TIME_MS = 5 * 60 * 1000;
const ANALYTICS_QUERY_GC_TIME_MS = 30 * 60 * 1000;
const ANALYTICS_WARNING_PREFIX = '[shop-analytics]';
const DEFAULT_ANALYTICS_ERROR_MESSAGE = 'Please try again in a moment.';
const NETWORK_ERROR_PATTERN = /(network|fetch|internet|timeout)/i;

export type TopProductsSortMode = 'highest-sales' | 'highest-sold-count';
export type RefundGraphMode = 'line' | 'bar';
export type GenderAnalysisMode = 'purchases' | 'refunds';

interface ShopRow {
    readonly id: number;
    readonly uid: string;
}

interface OrderItemRow {
    readonly order_id: number;
    readonly product_id: number | null;
    readonly product_name: string;
    readonly quantity: number;
    readonly total_price: number;
}

interface OrderRow {
    readonly id: number;
    readonly status: string;
    readonly buyer_id: number;
    readonly created_at: string;
}

interface TransactionRow {
    readonly order_id: number;
    readonly status: string;
    readonly updated_at: string;
}

interface UserGenderRow {
    readonly id: number;
    readonly gender: string;
}

interface ProductRow {
    readonly id: number;
    readonly uid: string;
    readonly thumbnail_url: string | null;
    readonly name: string;
}

interface CartActivityRow {
    readonly product_id: number;
    readonly created_at: string;
}

export interface AnalyticsPoint {
    readonly dateKey: string;
    readonly label: string;
    readonly value: number;
}

export interface TopProductAnalytics {
    readonly productId: number | null;
    readonly productUid: string | null;
    readonly productName: string;
    readonly thumbnailUrl: string | null;
    readonly soldCount: number;
    readonly salesAmount: number;
}

export interface AddToCartProductAnalytics {
    readonly productId: number;
    readonly productUid: string | null;
    readonly productName: string;
    readonly thumbnailUrl: string | null;
    readonly addToCartCount: number;
}

export interface GenderAnalyticsSlice {
    readonly key: string;
    readonly label: string;
    readonly value: number;
}

export interface CalendarHeatmapCell {
    readonly key: string;
    readonly dateKey: string | null;
    readonly dayNumber: number | null;
    readonly saleAmount: number;
    readonly intensity: number;
    readonly isCurrentMonth: boolean;
    readonly isToday: boolean;
}

export interface ShopAnalyticsTotals {
    readonly totalSalesAmount: number;
    readonly totalOrders: number;
    readonly totalRefunds: number;
}

export interface ShopAnalyticsData {
    readonly shopUid: string;
    readonly totals: ShopAnalyticsTotals;
    readonly dailySalesPoints: readonly AnalyticsPoint[];
    readonly refundCountPoints: readonly AnalyticsPoint[];
    readonly addToCartCountPoints: readonly AnalyticsPoint[];
    readonly dailySalesLookup: Readonly<Record<string, number>>;
    readonly refundCountLookup: Readonly<Record<string, number>>;
    readonly addToCartCountLookup: Readonly<Record<string, number>>;
    readonly topProductsBySales: readonly TopProductAnalytics[];
    readonly topProductsBySoldCount: readonly TopProductAnalytics[];
    readonly topProductsByAddToCart: readonly AddToCartProductAnalytics[];
    readonly purchaseGenderSlices: readonly GenderAnalyticsSlice[];
    readonly refundGenderSlices: readonly GenderAnalyticsSlice[];
    readonly saleCalendarCells: readonly CalendarHeatmapCell[];
}

function toDateKey(input: string | Date): string {
    const date = input instanceof Date ? input : new Date(input);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function formatPointLabel(dateKey: string): string {
    const date = new Date(`${dateKey}T00:00:00`);
    const monthLabel = date.toLocaleDateString(undefined, { month: 'short' });
    const dayLabel = date.toLocaleDateString(undefined, { day: 'numeric' });

    return `${monthLabel} ${dayLabel}`;
}

function buildTrailingDateKeys(windowDays: number): string[] {
    const keys: string[] = [];
    const now = new Date();

    for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
        const currentDate = new Date(now);
        currentDate.setDate(now.getDate() - offset);
        keys.push(toDateKey(currentDate));
    }

    return keys;
}

function normalizeGender(rawGender: string | null | undefined): string {
    if (rawGender === null || rawGender === undefined) {
        return 'unknown';
    }

    const normalized = rawGender.trim().toLowerCase();

    if (normalized.length === 0) return 'unknown';
    if (normalized.startsWith('m')) return 'male';
    if (normalized.startsWith('f')) return 'female';

    return normalized;
}

function formatGenderLabel(genderKey: string): string {
    if (genderKey === 'male') return 'Male';
    if (genderKey === 'female') return 'Female';
    if (genderKey === 'unknown') return 'Unknown';

    return genderKey.charAt(0).toUpperCase() + genderKey.slice(1);
}

function isRefundStatus(status: string): boolean {
    const normalizedStatus = status.trim().toLowerCase();

    return normalizedStatus.includes('refund') || normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
}

function isSuccessfulRefundTransactionStatus(status: string): boolean {
    const normalizedStatus = status.trim().toLowerCase();

    return normalizedStatus.includes('refund');
}

function buildCalendarCells(dailySalesLookup: Readonly<Record<string, number>>): CalendarHeatmapCell[] {
    const today = new Date();
    const year = today.getFullYear();
    const monthIndex = today.getMonth();

    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const totalDays = lastDay.getDate();
    const leadingPaddingCount = firstDay.getDay();

    const valuesForMonth: number[] = [];
    for (let day = 1; day <= totalDays; day += 1) {
        const dateKey = toDateKey(new Date(year, monthIndex, day));
        valuesForMonth.push(dailySalesLookup[dateKey] ?? 0);
    }

    const maxValue = Math.max(1, ...valuesForMonth);
    const cells: CalendarHeatmapCell[] = [];

    for (let padIndex = 0; padIndex < leadingPaddingCount; padIndex += 1) {
        cells.push({
            key: `pad-start-${padIndex}`,
            dateKey: null,
            dayNumber: null,
            saleAmount: 0,
            intensity: 0,
            isCurrentMonth: false,
            isToday: false,
        });
    }

    for (let day = 1; day <= totalDays; day += 1) {
        const date = new Date(year, monthIndex, day);
        const dateKey = toDateKey(date);
        const saleAmount = dailySalesLookup[dateKey] ?? 0;

        cells.push({
            key: dateKey,
            dateKey,
            dayNumber: day,
            saleAmount,
            intensity: saleAmount <= 0 ? 0 : saleAmount / maxValue,
            isCurrentMonth: true,
            isToday: dateKey === toDateKey(today),
        });
    }

    while (cells.length % 7 !== 0) {
        const padIndex = cells.length;
        cells.push({
            key: `pad-end-${padIndex}`,
            dateKey: null,
            dayNumber: null,
            saleAmount: 0,
            intensity: 0,
            isCurrentMonth: false,
            isToday: false,
        });
    }

    return cells;
}

function toSortedGenderSlices(valuesByGender: Readonly<Record<string, number>>): GenderAnalyticsSlice[] {
    return Object.entries(valuesByGender)
        .map(([key, value]) => ({
            key,
            label: formatGenderLabel(key),
            value,
        }))
        .filter((slice) => slice.value > 0)
        .sort((a, b) => b.value - a.value);
}

function chunkValues<T>(values: readonly T[], chunkSize: number): T[][] {
    if (values.length === 0) {
        return [];
    }

    const chunks: T[][] = [];

    for (let index = 0; index < values.length; index += chunkSize) {
        chunks.push(values.slice(index, index + chunkSize));
    }

    return chunks;
}

function buildEmptyAnalyticsData(shopUid: string): ShopAnalyticsData {
    const emptyDailyLookup: Record<string, number> = {};
    const emptyAddToCartLookup: Record<string, number> = {};
    const trailingDateKeys = buildTrailingDateKeys(DAILY_TREND_WINDOW_DAYS);

    for (const dateKey of trailingDateKeys) {
        emptyDailyLookup[dateKey] = 0;
        emptyAddToCartLookup[dateKey] = 0;
    }

    const emptyPoints: AnalyticsPoint[] = trailingDateKeys.map((dateKey) => ({
        dateKey,
        label: formatPointLabel(dateKey),
        value: 0,
    }));

    return {
        shopUid,
        totals: {
            totalSalesAmount: 0,
            totalOrders: 0,
            totalRefunds: 0,
        },
        dailySalesPoints: emptyPoints,
        refundCountPoints: emptyPoints,
        addToCartCountPoints: emptyPoints,
        dailySalesLookup: emptyDailyLookup,
        refundCountLookup: emptyDailyLookup,
        addToCartCountLookup: emptyAddToCartLookup,
        topProductsBySales: [],
        topProductsBySoldCount: [],
        topProductsByAddToCart: [],
        purchaseGenderSlices: [],
        refundGenderSlices: [],
        saleCalendarCells: buildCalendarCells(emptyDailyLookup),
    };
}

async function fetchOrdersByIds(orderIds: readonly number[]): Promise<OrderRow[]> {
    if (orderIds.length === 0) {
        return [];
    }

    const orderIdChunks = chunkValues(orderIds, QUERY_BATCH_SIZE);
    const orderResponses = await Promise.all(
        orderIdChunks.map((chunk) => supabase.from('orders').select('id, status, buyer_id, created_at').in('id', chunk)),
    );

    const mergedOrders: OrderRow[] = [];

    for (const response of orderResponses) {
        if (response.error !== null) {
            throw new Error(`Unable to load orders: ${response.error.message}`);
        }

        const responseOrders = (response.data ?? []) as OrderRow[];
        mergedOrders.push(...responseOrders);
    }

    return mergedOrders;
}

async function fetchShopProductsByShopId(shopId: number): Promise<Map<number, ProductRow>> {
    const { data, error } = await supabase
        .from('products')
        .select('id, uid, thumbnail_url, name')
        .eq('shop_id', shopId);

    if (error !== null) {
        console.warn(`${ANALYTICS_WARNING_PREFIX} products lookup failed: ${error.message}`);
        return new Map<number, ProductRow>();
    }

    const products = (data ?? []) as ProductRow[];
    const productsById = new Map<number, ProductRow>();

    for (const product of products) {
        productsById.set(product.id, product);
    }

    return productsById;
}

async function fetchCartActivityRowsByProductIds(productIds: readonly number[]): Promise<CartActivityRow[]> {
    if (productIds.length === 0) {
        return [];
    }

    const trailingDateKeys = buildTrailingDateKeys(DAILY_TREND_WINDOW_DAYS);
    const windowStartDateKey = trailingDateKeys[0] ?? toDateKey(new Date());
    const windowStartIso = `${windowStartDateKey}T00:00:00.000Z`;

    const productIdChunks = chunkValues(productIds, QUERY_BATCH_SIZE);
    const cartActivityResponses = await Promise.all(
        productIdChunks.map((chunk) => (
            supabase
                .from('cart_items')
                .select('product_id, created_at')
                .in('product_id', chunk)
                .gte('created_at', windowStartIso)
        )),
    );

    const cartActivityRows: CartActivityRow[] = [];

    for (const response of cartActivityResponses) {
        if (response.error !== null) {
            console.warn(`${ANALYTICS_WARNING_PREFIX} cart activity lookup failed: ${response.error.message}`);
            return [];
        }

        const responseRows = (response.data ?? []) as CartActivityRow[];
        cartActivityRows.push(...responseRows);
    }

    return cartActivityRows;
}

async function fetchBuyerGendersByIds(buyerIds: readonly number[]): Promise<Map<number, UserGenderRow>> {
    if (buyerIds.length === 0) {
        return new Map<number, UserGenderRow>();
    }

    const buyerIdChunks = chunkValues(buyerIds, QUERY_BATCH_SIZE);
    const buyerResponses = await Promise.all(
        buyerIdChunks.map((chunk) => supabase.from('users').select('id, gender').in('id', chunk)),
    );

    const usersById = new Map<number, UserGenderRow>();

    for (const response of buyerResponses) {
        if (response.error !== null) {
            console.warn(`${ANALYTICS_WARNING_PREFIX} buyer gender lookup failed: ${response.error.message}`);
            return new Map<number, UserGenderRow>();
        }

        const responseUsers = (response.data ?? []) as UserGenderRow[];
        for (const user of responseUsers) {
            usersById.set(user.id, user);
        }
    }

    return usersById;
}

async function fetchTransactionsByOrderIds(orderIds: readonly number[]): Promise<TransactionRow[]> {
    if (orderIds.length === 0) {
        return [];
    }

    const orderIdChunks = chunkValues(orderIds, QUERY_BATCH_SIZE);
    const transactionResponses = await Promise.all(
        orderIdChunks.map((chunk) => (
            supabase
                .from('transaction_history')
                .select('order_id, status, updated_at')
                .in('order_id', chunk)
        )),
    );

    const mergedTransactions: TransactionRow[] = [];

    for (const response of transactionResponses) {
        if (response.error !== null) {
            console.warn(`${ANALYTICS_WARNING_PREFIX} transaction lookup failed: ${response.error.message}`);
            return [];
        }

        const responseRows = (response.data ?? []) as TransactionRow[];
        mergedTransactions.push(...responseRows);
    }

    return mergedTransactions;
}

async function fetchShopAnalyticsData(shopUid: string): Promise<ShopAnalyticsData | null> {
    const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('id, uid')
        .eq('uid', shopUid)
        .is('deleted_at', null)
        .maybeSingle();

    if (shopError !== null) {
        throw new Error(`Unable to load shop: ${shopError.message}`);
    }

    if (shopData === null) {
        return null;
    }

    const shop = shopData as ShopRow;

    const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('order_id, product_id, product_name, quantity, total_price')
        .eq('shop_id', shop.id);

    if (orderItemsError !== null) {
        throw new Error(`Unable to load order items: ${orderItemsError.message}`);
    }

    const orderItems = (orderItemsData ?? []) as OrderItemRow[];
    const orderIds = Array.from(new Set(orderItems.map((item) => item.order_id)));

    const productsById = await fetchShopProductsByShopId(shop.id);
    const cartActivityRowsPromise = fetchCartActivityRowsByProductIds(Array.from(productsById.keys()));
    const ordersPromise = fetchOrdersByIds(orderIds);
    const transactionsPromise = fetchTransactionsByOrderIds(orderIds);

    const [cartActivityRows, orders, transactions] = await Promise.all([cartActivityRowsPromise, ordersPromise, transactionsPromise]);

    const buyerIds = Array.from(new Set(orders.map((order) => order.buyer_id)));
    const usersById = await fetchBuyerGendersByIds(buyerIds);

    const orderById = new Map(orders.map((order) => [order.id, order]));
    const refundedDateKeyByOrderId = new Map<number, string>();

    for (const transaction of transactions) {
        if (!isSuccessfulRefundTransactionStatus(transaction.status)) {
            continue;
        }

        refundedDateKeyByOrderId.set(transaction.order_id, toDateKey(transaction.updated_at));
    }

    const dailySalesLookup: Record<string, number> = {};
    const refundCountLookup: Record<string, number> = {};
    const addToCartCountLookup: Record<string, number> = {};
    const topProductsMap = new Map<string, TopProductAnalytics>();
    const topProductsByAddToCartMap = new Map<number, AddToCartProductAnalytics>();
    const purchaseGenderCountByKey: Record<string, number> = {};
    const refundGenderCountByKey: Record<string, number> = {};

    const saleOrderIds = new Set<number>();
    const refundOrderIds = new Set<number>();
    const refundOrdersCounted = new Set<number>();

    let totalSalesAmount = 0;

    for (const item of orderItems) {
        const parentOrder = orderById.get(item.order_id);
        if (parentOrder === undefined) continue;

        const orderDateKey = toDateKey(parentOrder.created_at);
        const refundDateKey = refundedDateKeyByOrderId.get(parentOrder.id);
        const buyer = usersById.get(parentOrder.buyer_id);
        const normalizedGender = normalizeGender(buyer?.gender);

        if (refundDateKey !== undefined || isRefundStatus(parentOrder.status)) {
            const effectiveRefundDateKey = refundDateKey ?? orderDateKey;

            if (!refundOrdersCounted.has(parentOrder.id)) {
                refundOrdersCounted.add(parentOrder.id);
                refundOrderIds.add(parentOrder.id);
                refundCountLookup[effectiveRefundDateKey] = (refundCountLookup[effectiveRefundDateKey] ?? 0) + 1;
                refundGenderCountByKey[normalizedGender] = (refundGenderCountByKey[normalizedGender] ?? 0) + 1;
            }

            continue;
        }

        saleOrderIds.add(parentOrder.id);

        dailySalesLookup[orderDateKey] = (dailySalesLookup[orderDateKey] ?? 0) + item.total_price;
        totalSalesAmount += item.total_price;
        purchaseGenderCountByKey[normalizedGender] = (purchaseGenderCountByKey[normalizedGender] ?? 0) + item.quantity;

        const productLookupKey = item.product_id === null ? `missing-${item.product_name}` : String(item.product_id);
        const mappedProduct = item.product_id !== null ? productsById.get(item.product_id) : undefined;

        const existingProduct = topProductsMap.get(productLookupKey);
        if (existingProduct !== undefined) {
            topProductsMap.set(productLookupKey, {
                ...existingProduct,
                soldCount: existingProduct.soldCount + item.quantity,
                salesAmount: existingProduct.salesAmount + item.total_price,
            });
            continue;
        }

        topProductsMap.set(productLookupKey, {
            productId: item.product_id,
            productUid: mappedProduct?.uid ?? null,
            productName: mappedProduct?.name ?? item.product_name,
            thumbnailUrl: mappedProduct?.thumbnail_url ?? null,
            soldCount: item.quantity,
            salesAmount: item.total_price,
        });
    }

    for (const cartActivity of cartActivityRows) {
        const activityDateKey = toDateKey(cartActivity.created_at);
        addToCartCountLookup[activityDateKey] = (addToCartCountLookup[activityDateKey] ?? 0) + 1;

        const mappedProduct = productsById.get(cartActivity.product_id);
        const existingProduct = topProductsByAddToCartMap.get(cartActivity.product_id);

        if (existingProduct !== undefined) {
            topProductsByAddToCartMap.set(cartActivity.product_id, {
                ...existingProduct,
                addToCartCount: existingProduct.addToCartCount + 1,
            });
            continue;
        }

        topProductsByAddToCartMap.set(cartActivity.product_id, {
            productId: cartActivity.product_id,
            productUid: mappedProduct?.uid ?? null,
            productName: mappedProduct?.name ?? 'Unknown Product',
            thumbnailUrl: mappedProduct?.thumbnail_url ?? null,
            addToCartCount: 1,
        });
    }

    const trailingDateKeys = buildTrailingDateKeys(DAILY_TREND_WINDOW_DAYS);
    const dailySalesPoints: AnalyticsPoint[] = trailingDateKeys.map((dateKey) => ({
        dateKey,
        label: formatPointLabel(dateKey),
        value: dailySalesLookup[dateKey] ?? 0,
    }));

    const refundCountPoints: AnalyticsPoint[] = trailingDateKeys.map((dateKey) => ({
        dateKey,
        label: formatPointLabel(dateKey),
        value: refundCountLookup[dateKey] ?? 0,
    }));

    const addToCartCountPoints: AnalyticsPoint[] = trailingDateKeys.map((dateKey) => ({
        dateKey,
        label: formatPointLabel(dateKey),
        value: addToCartCountLookup[dateKey] ?? 0,
    }));

    const topProducts = Array.from(topProductsMap.values());
    const topProductsByAddToCart = Array.from(topProductsByAddToCartMap.values()).sort((a, b) => {
        if (b.addToCartCount === a.addToCartCount) {
            return a.productName.localeCompare(b.productName);
        }

        return b.addToCartCount - a.addToCartCount;
    });

    const topProductsBySales = [...topProducts].sort((a, b) => {
        if (b.salesAmount === a.salesAmount) {
            return b.soldCount - a.soldCount;
        }

        return b.salesAmount - a.salesAmount;
    });

    const topProductsBySoldCount = [...topProducts].sort((a, b) => {
        if (b.soldCount === a.soldCount) {
            return b.salesAmount - a.salesAmount;
        }

        return b.soldCount - a.soldCount;
    });

    return {
        shopUid,
        totals: {
            totalSalesAmount,
            totalOrders: saleOrderIds.size,
            totalRefunds: refundOrderIds.size,
        },
        dailySalesPoints,
        refundCountPoints,
        addToCartCountPoints,
        dailySalesLookup,
        refundCountLookup,
        addToCartCountLookup,
        topProductsBySales,
        topProductsBySoldCount,
        topProductsByAddToCart,
        purchaseGenderSlices: toSortedGenderSlices(purchaseGenderCountByKey),
        refundGenderSlices: toSortedGenderSlices(refundGenderCountByKey),
        saleCalendarCells: buildCalendarCells(dailySalesLookup),
    };
}

export function getAnalyticsErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return DEFAULT_ANALYTICS_ERROR_MESSAGE;
    }

    const normalizedMessage = error.message.trim();
    if (normalizedMessage.length === 0) {
        return DEFAULT_ANALYTICS_ERROR_MESSAGE;
    }

    if (NETWORK_ERROR_PATTERN.test(normalizedMessage)) {
        return 'Please check your connection and retry.';
    }

    return normalizedMessage;
}

/**
 * Returns seller analytics derived from orders and order items for a specific shop.
 */
export function useShopAnalyticsData(shopUid: string | null): UseQueryResult<ShopAnalyticsData | null, Error> {
    return useQuery<ShopAnalyticsData | null>({
        queryKey: ['shop-analytics', shopUid ?? ''],
        queryFn: () => fetchShopAnalyticsData(shopUid ?? ''),
        enabled: shopUid !== null && shopUid.length > 0,
        staleTime: ANALYTICS_QUERY_STALE_TIME_MS,
        gcTime: ANALYTICS_QUERY_GC_TIME_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: 1,
        placeholderData: (previousData) => previousData,
    });
}
