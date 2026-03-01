import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabase/supabaseClient';

/**
 * Handles real-time subscriptions for orders, chat, and more.
 */
export const realtimeSubscriptions = {
  /**
   * Subscribes to status changes for a specific order.
   */
  subscribeToOrderStatus(orderId: string, callback: (payload: any) => void): RealtimeChannel {
    return supabase
      .channel(`order_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `uid=eq.${orderId}`
        },
        callback
      )
      .subscribe();
  },

  /**
   * Subscribes to new messages in a specific chat thread.
   */
  subscribeToChatMessages(threadId: string, callback: (payload: any) => void): RealtimeChannel {
    return supabase
      .channel(`chat_${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`
        },
        callback
      )
      .subscribe();
  },

  /**
   * Cleans up and removes a real-time channel.
   */
  unsubscribe(channel: RealtimeChannel): void {
    supabase.removeChannel(channel);
  }
};
