import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    };
    products: {
        uid: string;
        name: string;
        thumbnail_url: string;
        deleted_at: string | null;
    };
}

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

const getEffectivePrice = (variant: CartItemRaw['product_variants']): number => {
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

const mapToCartItemData = (raw: CartItemRaw): CartItemData => ({
    uid: raw.uid,
    productUid: raw.products.uid,
    productName: raw.products.name,
    variantName: raw.product_variants.name,
    price: getEffectivePrice(raw.product_variants),
    thumbnailUrl: raw.products.thumbnail_url,
    quantity: raw.quantity,
    stock: raw.product_variants.stock,
    isAvailable: raw.products.deleted_at === null && raw.product_variants.stock > 0,
    hasPriceChanged: false,
});

// ─── Fetch fn ─────────────────────────────────────────────────────────────────

async function fetchCartItems(userId: number): Promise<CartItemData[]> {
    const { data, error } = await supabase
        .from('cart_items')
        .select('*, product_variants(*), products!inner(uid, name, thumbnail_url, deleted_at)')
        .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return (data as unknown as CartItemRaw[] | null ?? []).map(mapToCartItemData);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Query: fetches all cart items for the given user.
 * Cached for 30 seconds — cart data should be nearly real-time.
 */
export function useCartItems(userId: number | null) {
    return useQuery({
        queryKey: queryKeys.cart(userId ?? 0),
        queryFn: () => fetchCartItems(userId!),
        enabled: userId !== null,
        staleTime: 30 * 1000, // 30 seconds
    });
}

/**
 * Mutation: update a cart item's quantity.
 * Applies an optimistic update immediately, then syncs to the DB.
 * Reverts on error.
 */
export function useUpdateCartQuantity(userId: number | null) {
    const qc = useQueryClient();
    const cacheKey = queryKeys.cart(userId ?? 0);

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
export function useDeleteCartItems(userId: number | null) {
    const qc = useQueryClient();
    const cacheKey = queryKeys.cart(userId ?? 0);

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
