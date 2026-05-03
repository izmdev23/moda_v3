import { UseMutationResult, UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/supabaseClient';
import { queryKeys } from '../utils/query-keys';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItemRaw {
    id: number;
    uid: string;
    quantity: number;
    product_id: number;
    variant_id: number;
    product_variants: {
        uid: string;
        name: string;
        price: number;
        stock: number;
        image_url: string | null;
        sale_price: number | null;
        sale_start_date: string | null;
        sale_end_date: string | null;
    } | {
        uid: string;
        name: string;
        price: number;
        stock: number;
        image_url: string | null;
        sale_price: number | null;
        sale_start_date: string | null;
        sale_end_date: string | null;
    }[] | null;
    products: {
        uid: string;
        name: string;
        thumbnail_url: string | null;
        deleted_at: string | null;
    } | {
        uid: string;
        name: string;
        thumbnail_url: string | null;
        deleted_at: string | null;
    }[] | null;
}

type CartVariantRelation = {
    uid: string;
    name: string;
    price: number;
    stock: number;
    image_url: string | null;
    sale_price: number | null;
    sale_start_date: string | null;
    sale_end_date: string | null;
};

type CartProductRelation = {
    uid: string;
    name: string;
    thumbnail_url: string | null;
    deleted_at: string | null;
};

export interface CartItemData {
    readonly uid: string;
    readonly productUid: string;
    readonly productName: string;
    readonly variantName: string;
    readonly price: number;
    readonly thumbnailUrl: string;
    readonly quantity: number;
    readonly stock: number;
    readonly isAvailable: boolean;
    readonly hasPriceChanged: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_PRODUCT_NAME = 'Unavailable Product';
const FALLBACK_VARIANT_NAME = 'Unavailable Variant';
const FALLBACK_IMAGE_URL = '';

function normalizeUserId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (trimmedValue === '' || trimmedValue === 'null' || trimmedValue === 'undefined') {
            return null;
        }

        const parsedValue = Number(trimmedValue);
        if (Number.isInteger(parsedValue) && Number.isFinite(parsedValue) && parsedValue > 0) {
            return parsedValue;
        }
    }

    return null;
}

function pickRelationRow<T>(relation: T | T[] | null): T | null {
    if (relation === null) return null;
    if (Array.isArray(relation)) return relation[0] ?? null;
    return relation;
}

const getEffectivePrice = (variant: CartVariantRelation | null): number => {
    if (variant === null) return 0;

    const now = new Date();
    if (
        variant.sale_price !== null &&
        variant.sale_start_date !== null &&
        variant.sale_end_date !== null &&
        new Date(variant.sale_start_date) <= now &&
        new Date(variant.sale_end_date) >= now
    ) {
        return variant.sale_price;
    }
    return variant.price;
};

const mapToCartItemData = (raw: CartItemRaw): CartItemData => {
    const product = pickRelationRow<CartProductRelation>(raw.products);
    const variant = pickRelationRow<CartVariantRelation>(raw.product_variants);

    const stock = variant?.stock ?? 0;
    const productDeleted = product?.deleted_at !== null && product?.deleted_at !== undefined;

    return {
        uid: raw.uid,
        productUid: product?.uid ?? '',
        productName: product?.name ?? FALLBACK_PRODUCT_NAME,
        variantName: variant?.name ?? FALLBACK_VARIANT_NAME,
        price: getEffectivePrice(variant),
        thumbnailUrl: product?.thumbnail_url ?? variant?.image_url ?? FALLBACK_IMAGE_URL,
        quantity: raw.quantity,
        stock,
        isAvailable: !productDeleted && variant !== null && stock > 0,
        hasPriceChanged: false,
    };
};

// ─── Fetch fn ─────────────────────────────────────────────────────────────────

async function fetchCartItems(userId: number): Promise<CartItemData[]> {
    const { data, error } = await supabase
        .from('cart_items')
        .select('id, uid, quantity, product_id, variant_id, product_variants(uid, name, price, stock, image_url, sale_price, sale_start_date, sale_end_date), products(uid, name, thumbnail_url, deleted_at)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const rawItems = (data as unknown as CartItemRaw[] | null) ?? [];
    return rawItems.map(mapToCartItemData);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Query: fetches all cart items for the given user.
 * Cached for 30 seconds — cart data should be nearly real-time.
 */
export function useCartItems(userId: number | null): UseQueryResult<CartItemData[], Error> {
    const normalizedUserId = normalizeUserId(userId);

    return useQuery({
        queryKey: queryKeys.cart(normalizedUserId ?? 0),
        queryFn: () => {
            if (normalizedUserId === null) {
                throw new Error('Unable to load cart: invalid user identifier.');
            }

            return fetchCartItems(normalizedUserId);
        },
        enabled: normalizedUserId !== null,
        staleTime: 30 * 1000, // 30 seconds
    });
}

/**
 * Mutation: update a cart item's quantity.
 * Applies an optimistic update immediately, then syncs to the DB.
 * Reverts on error.
 */
export function useUpdateCartQuantity(userId: number | null): UseMutationResult<void, Error, { uid: string; quantity: number }, { previous: CartItemData[] | undefined }> {
    const qc = useQueryClient();
    const normalizedUserId = normalizeUserId(userId);
    const cacheKey = queryKeys.cart(normalizedUserId ?? 0);

    return useMutation({
        mutationFn: async ({ uid, quantity }: { uid: string; quantity: number }) => {
            const { error } = await supabase
                .from('cart_items')
                .update({ quantity })
                .eq('uid', uid);
            if (error) throw new Error(error.message);
        },
        onMutate: async ({ uid, quantity }) => {
            await qc.cancelQueries({ queryKey: cacheKey });
            const previous = qc.getQueryData<CartItemData[]>(cacheKey);
            qc.setQueryData<CartItemData[]>(cacheKey, (old) =>
                old?.map((i) => i.uid === uid ? { ...i, quantity } : i) ?? []
            );
            return { previous };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.previous) qc.setQueryData(cacheKey, ctx.previous);
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: cacheKey });
        },
    });
}

/**
 * Mutation: delete one or more cart items by UID.
 * Optimistically removes from cache; invalidates on settle.
 */
export function useDeleteCartItems(userId: number | null): UseMutationResult<void, Error, string[], { previous: CartItemData[] | undefined }> {
    const qc = useQueryClient();
    const normalizedUserId = normalizeUserId(userId);
    const cacheKey = queryKeys.cart(normalizedUserId ?? 0);

    return useMutation({
        mutationFn: async (uids: string[]) => {
            const { error } = await supabase
                .from('cart_items')
                .delete()
                .in('uid', uids);
            if (error) throw new Error(error.message);
        },
        onMutate: async (uids) => {
            await qc.cancelQueries({ queryKey: cacheKey });
            const previous = qc.getQueryData<CartItemData[]>(cacheKey);
            qc.setQueryData<CartItemData[]>(cacheKey, (old) =>
                old?.filter((i) => !uids.includes(i.uid)) ?? []
            );
            return { previous };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.previous) qc.setQueryData(cacheKey, ctx.previous);
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: cacheKey });
        },
    });
}
