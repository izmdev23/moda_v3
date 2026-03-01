import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { DatabaseResult } from '../../supabase/types';
import { BaseApi } from './api';

/**
 * API layer for the 'product_images' table.
 */
export class ProductImagesApi extends BaseApi<'product_images'> {
    constructor() {
        super('product_images');
    }

    /**
     * Fetches all images for a specific product.
     * 
     * @param productId - The numeric ID of the product.
     * @returns A promise resolving to the database result containing an array of product images.
     */
    async getByProductId(productId: number): Promise<DatabaseResult<Tables<'product_images'>[]>> {
        const { data, error } = await supabase
            .from('product_images')
            .select('*')
            .eq('product_id', productId)
            .order('sort_order', { ascending: true });

        return { data: data as Tables<'product_images'>[] | null, error };
    }
}

export const productImagesTable: ProductImagesApi = new ProductImagesApi();

/**
 * API layer for the 'product_variants' table.
 */
export class ProductVariantsApi extends BaseApi<'product_variants'> {
    constructor() {
        super('product_variants');
    }

    /**
     * Fetches all variants for a specific product.
     * 
     * @param productId - The numeric ID of the product.
     * @returns A promise resolving to the database result containing an array of product variants.
     */
    async getByProductId(productId: number): Promise<DatabaseResult<Tables<'product_variants'>[]>> {
        const { data, error } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', productId);

        return { data: data as Tables<'product_variants'>[] | null, error };
    }
}

export const productVariantsTable: ProductVariantsApi = new ProductVariantsApi();

/**
 * API layer for the 'ratings' table.
 */
export class RatingsApi extends BaseApi<'ratings'> {
    constructor() {
        super('ratings');
    }

    /**
     * Fetches all ratings for a specific product.
     * 
     * @param productId - The numeric ID of the product.
     * @returns A promise resolving to the database result containing an array of ratings.
     */
    async getByProductId(productId: number): Promise<DatabaseResult<Tables<'ratings'>[]>> {
        const { data, error } = await supabase
            .from('ratings')
            .select('*')
            .eq('product_id', productId);

        return { data: data as Tables<'ratings'>[] | null, error };
    }

    /**
     * Gets the average rating for a product using a database function.
     * 
     * @param productId - The numeric ID of the product.
     * @returns A promise resolving to the numeric average rating.
     */
    async getAverageForProduct(productId: number): Promise<{ data: number | null; error: unknown }> {
        const { data, error } = await supabase.rpc('get_average_rating', {
            p_product_id: productId,
        });

        return { data: data as number | null, error };
    }
}

export const ratingsTable: RatingsApi = new RatingsApi();

/**
 * Extended cart item type with variant details.
 */
export type CartItemWithVariant = Tables<'cart_items'> & {
    product_variants: Tables<'product_variants'>;
};

/**
 * API layer for the 'cart_items' table.
 */
export class CartItemsApi extends BaseApi<'cart_items'> {
    constructor() {
        super('cart_items');
    }

    /**
     * Fetches cart items for a specific user, including variant details.
     * 
     * @param userId - The numeric ID of the user.
     * @returns A promise resolving to the database result containing an array of cart items with variants.
     */
    async getByUserId(userId: number): Promise<DatabaseResult<CartItemWithVariant[]>> {
        const { data, error } = await supabase
            .from('cart_items')
            .select('*, product_variants(*)')
            .eq('user_id', userId);

        return { data: (data as unknown) as CartItemWithVariant[] | null, error };
    }

    /**
     * Completely clears the cart for a specific user.
     * 
     * @param userId - The numeric ID of the user.
     * @returns A promise resolving to the database error if any.
     */
    async clearCart(userId: number): Promise<{ error: unknown }> {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', userId);

        return { error };
    }
}

export const cartItemsTable: CartItemsApi = new CartItemsApi();
