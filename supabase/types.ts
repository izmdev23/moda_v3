import { PostgrestError } from '@supabase/supabase-js';

export interface DatabaseResult<T> {
    data: T | null;
    error: PostgrestError | Error | null;
}

// Re-export or define detailed row/insert/update types if needed.
// For now, using generic types.
export type Tables = 'users' | 'shops' | 'products' | 'product_images' | 'product_variants' | 'ratings' | 'cart_items' | 'orders' | 'order_items' | 'addresses' | 'administrative_boundaries' | 'payment_methods' | 'transaction_history' | 'vton_usage' | 'shop_follows' | 'product_drafts' | 'reviews' | 'review_images' | 'chat_threads' | 'chat_messages' | 'product_views' | 'user_activity_log' | 'user_category_affinity' | 'user_tag_affinity' | 'user_recommendations' | 'shop_analytics_cache' | 'refund_requests' | 'buyer_credits' | 'buyer_credit_transactions' | 'app_notifications';
