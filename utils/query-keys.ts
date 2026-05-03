/**
 * Centralized query key factory.
 *
 * Using structured key arrays lets `queryClient.invalidateQueries` target
 * whole namespaces (e.g. invalidate all cart keys for a user) or single entries.
 *
 * @example
 * // Invalidate all cart data for a user
 * queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) });
 *
 * // Invalidate a specific product
 * queryClient.invalidateQueries({ queryKey: queryKeys.products.byUid(uid) });
 */

import type { ProductCategory } from './types';

export type CatalogFilters = {
    query: string;
    isShopSearch: boolean;
    category: ProductCategory | null;
    minPrice: number | null;
    maxPrice: number | null;
    minRating: number | null;
    sort: string;
};

export const queryKeys = {
    // ── User identity ───────────────────────────────────────────────────────
    currentUser: ['currentUser'] as const,

    // ── Products ────────────────────────────────────────────────────────────
    products: {
        /** Paginated catalog list — scoped to the full filter/sort state */
        list: (filters: CatalogFilters) => ['products', 'list', filters] as const,
        /** Single product by public UID */
        byUid: (uid: string) => ['products', 'byUid', uid] as const,
        /** Products belonging to a shop */
        byShop: (shopId: number) => ['products', 'byShop', shopId] as const,
        /** Featured shops carousel data */
        featured: ['products', 'featured'] as const,
        /** Trending products (48-hour view window) */
        trending: ['products', 'trending'] as const,
        /** Personalised recommendations for a user */
        recommendations: (userId: number) => ['products', 'recommendations', userId] as const,
    },

    // ── Product sub-resources ───────────────────────────────────────────────
    productImages: (productId: number) => ['productImages', productId] as const,
    productVariants: (productId: number) => ['productVariants', productId] as const,
    productRatings: (productId: number) => ['productRatings', productId] as const,
    productRatingAverage: (productId: number) => ['productRatingAverage', productId] as const,
    userRating: (productId: number, userId: number) => ['userRating', productId, userId] as const,
    reviews: (productId: number) => ['reviews', productId] as const,
    myReview: (productId: number, userId: number) => ['myReview', productId, userId] as const,
    shopForProduct: (shopId: number) => ['shopForProduct', shopId] as const,

    // ── Cart ────────────────────────────────────────────────────────────────
    cart: (userId: number) => ['cart', userId] as const,

    // ── Addresses ───────────────────────────────────────────────────────────
    addresses: (userId: number) => ['addresses', userId] as const,

    // ── Payment methods ─────────────────────────────────────────────────────
    paymentMethods: (userId: number) => ['paymentMethods', userId] as const,

    // ── Buyer credits ───────────────────────────────────────────────────────
    buyerCredits: (userId: number) => ['buyerCredits', userId] as const,

    // ── In-app notifications ────────────────────────────────────────────────
    notifications: (userId: number) => ['notifications', userId] as const,

    // ── Orders ──────────────────────────────────────────────────────────────
    orders: {
        byBuyer: (userId: number) => ['orders', 'buyer', userId] as const,
        bySeller: (shopId: number) => ['orders', 'seller', shopId] as const,
    },

    // ── Refund requests ─────────────────────────────────────────────────────
    refunds: {
        byBuyer: (userId: number) => ['refunds', 'buyer', userId] as const,
        bySeller: (userId: number) => ['refunds', 'seller', userId] as const,
    },

    // ── Shop ────────────────────────────────────────────────────────────────
    shop: (userId: number) => ['shop', userId] as const,
    shopById: (shopId: number) => ['shopById', shopId] as const,
} as const;
