import { useQuery } from '@tanstack/react-query';
import { Json, Tables } from '../supabase/database.types';
import { supabase } from '../supabase/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductVariantPriceRow {
    readonly price: number;
    readonly sale_price: number | null;
    readonly sale_start_date: string | null;
    readonly sale_end_date: string | null;
    readonly stock: number;
}

interface ProductWithVariantsRow {
    readonly id: number;
    readonly uid: string;
    readonly name: string;
    readonly thumbnail_url: string;
    readonly rating_avg: number;
    readonly total_sales: number;
    readonly tags: Json;
    readonly created_at: string;
    readonly product_variants: readonly ProductVariantPriceRow[] | null;
}

interface ProductOrderItemRow {
    readonly order_id: number;
    readonly product_id: number | null;
    readonly quantity: number;
}

interface ProductOrderStatusRow {
    readonly id: number;
    readonly status: string;
}

export interface MyStoreProduct {
    readonly id: number;
    readonly uid: string;
    readonly name: string;
    readonly thumbnailUrl: string;
    readonly rating: number;
    readonly totalSales: number;
    readonly totalStock: number;
    readonly tags: readonly string[];
    readonly minPrice: number;
    readonly maxPrice: number;
    readonly salePrice: number | null;
    readonly originalPriceForSale: number | null;
    readonly createdAt: string;
}

export interface MyStoreShop {
    readonly uid: string;
    readonly shopName: string;
    readonly location: string;
    readonly description: string;
    readonly followerCount: number;
    readonly bannerUrl: string | null;
    readonly ownerUserId: number;
}

export interface MyStoreData {
    readonly shop: MyStoreShop;
    readonly products: readonly MyStoreProduct[];
}

const NO_DESCRIPTION_TEXT = 'No shop description yet.';
const NO_LOCATION_TEXT = 'Location not available';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTags(rawTags: Json): string[] {
    if (Array.isArray(rawTags)) {
        const parsed = rawTags
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0);

        return Array.from(new Set(parsed));
    }

    if (typeof rawTags === 'string') {
        const parsed = rawTags
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

        return Array.from(new Set(parsed));
    }

    return [];
}

function isRefundOrderStatus(status: string): boolean {
    const normalizedStatus = status.trim().toLowerCase();

    return normalizedStatus.includes('refund') || normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
}

async function fetchSoldCountByProductId(
    shopId: number,
    productIds: readonly number[],
): Promise<Readonly<Record<number, number>>> {
    if (productIds.length === 0) {
        return {};
    }

    const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('order_id, product_id, quantity')
        .eq('shop_id', shopId)
        .in('product_id', productIds);

    if (orderItemsError !== null) {
        throw new Error(orderItemsError.message);
    }

    const orderItems = (orderItemsData ?? []) as ProductOrderItemRow[];
    const orderIds = Array.from(new Set(orderItems.map((item) => item.order_id)));

    if (orderIds.length === 0) {
        return {};
    }

    const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, status')
        .in('id', orderIds);

    if (ordersError !== null) {
        throw new Error(ordersError.message);
    }

    const refundedOrderIds = new Set<number>();
    for (const order of (ordersData ?? []) as ProductOrderStatusRow[]) {
        if (isRefundOrderStatus(order.status)) {
            refundedOrderIds.add(order.id);
        }
    }

    const soldCountByProductId: Record<number, number> = {};
    for (const item of orderItems) {
        if (item.product_id === null) {
            continue;
        }

        if (refundedOrderIds.has(item.order_id)) {
            continue;
        }

        soldCountByProductId[item.product_id] = (soldCountByProductId[item.product_id] ?? 0) + item.quantity;
    }

    return soldCountByProductId;
}

function mapProductRow(row: ProductWithVariantsRow, soldCountByProductId: Readonly<Record<number, number>>): MyStoreProduct {
    const variants = row.product_variants ?? [];
    const prices = variants.map((variant) => variant.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const totalStock = variants.reduce((runningTotal, variant) => runningTotal + variant.stock, 0);
    const now = new Date();

    const activeSaleVariant = variants.find((variant) => {
        if (variant.sale_price === null) return false;
        if (variant.sale_start_date === null || variant.sale_end_date === null) return false;

        const saleStart = new Date(variant.sale_start_date);
        const saleEnd = new Date(variant.sale_end_date);

        return saleStart <= now && saleEnd >= now;
    });

    const hasSoldCountOverride = Object.prototype.hasOwnProperty.call(soldCountByProductId, row.id);
    const resolvedSoldCount = hasSoldCountOverride ? soldCountByProductId[row.id] ?? 0 : row.total_sales;

    return {
        id: row.id,
        uid: row.uid,
        name: row.name,
        thumbnailUrl: row.thumbnail_url,
        rating: row.rating_avg,
        totalSales: resolvedSoldCount,
        totalStock,
        tags: normalizeTags(row.tags),
        minPrice,
        maxPrice,
        salePrice: activeSaleVariant?.sale_price ?? null,
        originalPriceForSale: activeSaleVariant?.price ?? null,
        createdAt: row.created_at,
    };
}

function buildLocation(shop: Pick<Tables<'shops'>, 'city' | 'province'>): string {
    const city = shop.city.trim();
    const province = shop.province.trim();

    if (city.length > 0 && province.length > 0) {
        return `${city}, ${province}`;
    }

    if (city.length > 0) return city;
    if (province.length > 0) return province;

    return NO_LOCATION_TEXT;
}

// ─── Fetch fn ─────────────────────────────────────────────────────────────────

async function fetchMyStoreData(shopUid: string): Promise<MyStoreData | null> {
    const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('id, uid, shop_name, city, province, description, banner_url, user_id')
        .eq('uid', shopUid)
        .is('deleted_at', null)
        .maybeSingle();

    if (shopError) {
        throw new Error(shopError.message);
    }

    if (shopData === null) {
        return null;
    }

    const followerCountPromise = supabase
        .from('shop_follows')
        .select('id', { head: true, count: 'exact' })
        .eq('shop_id', shopData.id);

    const productsPromise = supabase
        .from('products')
        .select(`
            id,
            uid,
            name,
            thumbnail_url,
            rating_avg,
            total_sales,
            tags,
            created_at,
            product_variants (
                price,
                sale_price,
                sale_start_date,
                sale_end_date,
                stock
            )
        `)
        .eq('shop_id', shopData.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    const [followerCountResult, productsResult] = await Promise.all([followerCountPromise, productsPromise]);

    if (followerCountResult.error) {
        throw new Error(followerCountResult.error.message);
    }

    if (productsResult.error) {
        throw new Error(productsResult.error.message);
    }

    const productRows = (productsResult.data ?? []) as unknown as ProductWithVariantsRow[];
    const productIds = productRows.map((row) => row.id);

    let soldCountByProductId: Readonly<Record<number, number>> = {};
    try {
        soldCountByProductId = await fetchSoldCountByProductId(shopData.id, productIds);
    } catch (soldCountError: unknown) {
        console.warn('[my-store] Falling back to products.total_sales for best-seller counts:', soldCountError);
    }

    return {
        shop: {
            uid: shopData.uid,
            shopName: shopData.shop_name,
            location: buildLocation(shopData),
            description: shopData.description?.trim() ? shopData.description : NO_DESCRIPTION_TEXT,
            followerCount: followerCountResult.count ?? 0,
            bannerUrl: shopData.banner_url,
            ownerUserId: shopData.user_id,
        },
        products: productRows.map((row) => mapProductRow(row, soldCountByProductId)),
    };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches all data required by the My Store screen from a shop UID.
 */
export function useMyStoreData(shopUid: string | null) {
    return useQuery({
        queryKey: ['my-store', shopUid ?? ''],
        queryFn: () => fetchMyStoreData(shopUid ?? ''),
        enabled: shopUid !== null && shopUid.length > 0,
        staleTime: 2 * 60 * 1000,
    });
}
