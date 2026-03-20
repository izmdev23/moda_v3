import { Tables } from '../../supabase/database.types'; /**
 * Miscellaneous tables API definitions.
 * All classes are strictly typed based on the Supabase/PostgreSQL schema.
 */
import { supabase } from '../../supabase/supabaseClient';
import { DatabaseResult } from '../../supabase/types';
import { BaseApi } from './api';

export class AddressesApi extends BaseApi<'addresses'> {
    constructor() { super('addresses'); }
}
export const addressesTable = new AddressesApi();

export class AdministrativeBoundariesApi extends BaseApi<'administrative_boundaries'> {
    constructor() { super('administrative_boundaries'); }
}
export const adminBoundariesTable = new AdministrativeBoundariesApi();

export class PaymentMethodsApi extends BaseApi<'payment_methods'> {
    constructor() { super('payment_methods'); }

    async getByUserId(userId: number): Promise<DatabaseResult<Tables<'payment_methods'>[]>> {
        const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false });

        return { data: data as Tables<'payment_methods'>[] | null, error };
    }

    async getDefaultByUserId(userId: number): Promise<DatabaseResult<Tables<'payment_methods'> | null>> {
        const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('user_id', userId)
            .eq('is_default', true)
            .maybeSingle();

        return { data: data as Tables<'payment_methods'> | null, error };
    }

    async setDefault(uid: string, userId: number): Promise<DatabaseResult<void>> {
        // first remove default
        await supabase
            .from('payment_methods')
            .update({ is_default: false })
            .eq('user_id', userId);

        // set new default
        const { error } = await supabase
            .from('payment_methods')
            .update({ is_default: true })
            .eq('uid', uid);

        return { data: null, error };
    }
}
export const paymentMethodsTable = new PaymentMethodsApi();

export class TransactionHistoryApi extends BaseApi<'transaction_history'> {
    constructor() { super('transaction_history'); }
}
export const transactionHistoryTable = new TransactionHistoryApi();

export class VtonUsageApi extends BaseApi<'vton_usage'> {
    constructor() { super('vton_usage'); }
}
export const vtonUsageTable = new VtonUsageApi();

export class ProductDraftsApi extends BaseApi<'product_drafts'> {
    constructor() { super('product_drafts'); }
}
export const productDraftsTable = new ProductDraftsApi();

export class ChatThreadsApi extends BaseApi<'chat_threads'> {
    constructor() { super('chat_threads'); }
}
export const chatThreadsTable = new ChatThreadsApi();

export class ChatMessagesApi extends BaseApi<'chat_messages'> {
    constructor() { super('chat_messages'); }
}
export const chatMessagesTable = new ChatMessagesApi();

export class ProductViewsApi extends BaseApi<'product_views'> {
    constructor() { super('product_views'); }
}
export const productViewsTable = new ProductViewsApi();

export class UserActivityLogApi extends BaseApi<'user_activity_log'> {
    constructor() { super('user_activity_log'); }
}
export const userActivityTable = new UserActivityLogApi();

export class UserRecommendationsApi extends BaseApi<'user_recommendations'> {
    constructor() { super('user_recommendations'); }
}
export const recommendationsTable = new UserRecommendationsApi();

export class ShopAnalyticsCacheApi extends BaseApi<'shop_analytics_cache'> {
    constructor() { super('shop_analytics_cache'); }
}
export const shopAnalyticsTable = new ShopAnalyticsCacheApi();
