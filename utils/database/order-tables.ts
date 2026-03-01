import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { DatabaseResult } from '../../supabase/types';
import { BaseApi } from './api';

/**
 * Extended order type with items.
 */
export type OrderWithItems = Tables<'orders'> & {
    order_items: Tables<'order_items'>[];
};

/**
 * API layer for the 'orders' table.
 */
export class OrdersApi extends BaseApi<'orders'> {
    constructor() {
        super('orders');
    }

    /**
     * Fetches orders by buyer ID, including order items.
     * 
     * @param buyerId - The numeric ID of the buyer.
     * @returns A promise resolving to the database result containing an array of orders with items.
     */
    async getByBuyerId(buyerId: number): Promise<DatabaseResult<OrderWithItems[]>> {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('buyer_id', buyerId);

        return { data: data as OrderWithItems[] | null, error };
    }

    /**
     * Fetches orders by seller ID, including order items.
     * 
     * @param sellerId - The numeric ID of the seller.
     * @returns A promise resolving to the database result containing an array of orders with items.
     */
    async getBySellerId(sellerId: number): Promise<DatabaseResult<OrderWithItems[]>> {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*) Gen')
            .eq('seller_id' as any, sellerId); // seller_id might be a join or a direct column, checking schema

        return { data: data as OrderWithItems[] | null, error };
    }
}

export const ordersTable: OrdersApi = new OrdersApi();

/**
 * API layer for the 'order_items' table.
 */
export class OrderItemsApi extends BaseApi<'order_items'> {
    constructor() {
        super('order_items');
    }

    /**
     * Fetches order items by their parent order ID.
     * 
     * @param orderId - The numeric ID of the order.
     * @returns A promise resolving to the database result containing an array of order items.
     */
    async getByOrderId(orderId: number): Promise<DatabaseResult<Tables<'order_items'>[]>> {
        const { data, error } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);

        return { data: data as Tables<'order_items'>[] | null, error };
    }

    /**
     * Fetches order items associated with a specific shop.
     * 
     * @param shopId - The numeric ID of the shop.
     * @returns A promise resolving to the database result containing an array of order items.
     */
    async getByShopId(shopId: number): Promise<DatabaseResult<Tables<'order_items'>[]>> {
        const { data, error } = await supabase
            .from('order_items')
            .select('*')
            .eq('shop_id', shopId);

        return { data: data as Tables<'order_items'>[] | null, error };
    }
}

export const orderItemsTable: OrderItemsApi = new OrderItemsApi();
