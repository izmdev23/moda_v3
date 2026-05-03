import { UseMutationResult, UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/supabaseClient';
import { queryKeys } from '../utils/query-keys';

export type RefundRequestStatus = 'pending' | 'accepted' | 'rejected';

interface RefundRequestRow {
    readonly uid: string;
    readonly order_item_uid: string;
    readonly buyer_id: number;
    readonly product_name: string;
    readonly variant_name: string;
    readonly refund_amount: number;
    readonly reason: string;
    readonly evidence_image_urls: string[];
    readonly status: string;
    readonly seller_response: string | null;
    readonly created_at: string;
    readonly resolved_at: string | null;
}

interface BuyerNameRow {
    readonly id: number;
    readonly first_name: string;
    readonly last_name: string;
    readonly avatar_url: string | null;
}

interface NotificationRow {
    readonly uid: string;
    readonly title: string;
    readonly message: string;
    readonly notification_type: string;
    readonly metadata: Record<string, unknown>;
    readonly is_read: boolean;
    readonly created_at: string;
}

interface BuyerCreditsRow {
    readonly balance: number;
}

export interface SellerRefundRequestItem {
    readonly uid: string;
    readonly orderItemUid: string;
    readonly buyerName: string;
    readonly buyerAvatarUrl: string | null;
    readonly productName: string;
    readonly variantName: string;
    readonly refundAmount: number;
    readonly reason: string;
    readonly evidenceImageUrls: readonly string[];
    readonly status: RefundRequestStatus;
    readonly sellerResponse: string | null;
    readonly createdAt: string;
    readonly resolvedAt: string | null;
}

export interface AppNotificationItem {
    readonly uid: string;
    readonly title: string;
    readonly message: string;
    readonly type: string;
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly isRead: boolean;
    readonly createdAt: string;
}

function toRefundStatus(status: string): RefundRequestStatus {
    const normalizedStatus = status.trim().toLowerCase();

    if (normalizedStatus === 'accepted') {
        return 'accepted';
    }

    if (normalizedStatus === 'rejected') {
        return 'rejected';
    }

    return 'pending';
}

async function fetchSellerRefundRequests(sellerUserId: number): Promise<readonly SellerRefundRequestItem[]> {
    const { data: rows, error } = await supabase
        .from('refund_requests')
        .select('uid, order_item_uid, buyer_id, product_name, variant_name, refund_amount, reason, evidence_image_urls, status, seller_response, created_at, resolved_at')
        .eq('seller_user_id', sellerUserId)
        .order('created_at', { ascending: false });

    if (error !== null) {
        throw new Error(error.message);
    }

    const refundRows = (rows ?? []) as RefundRequestRow[];
    if (refundRows.length === 0) {
        return [];
    }

    const buyerIds = Array.from(new Set(refundRows.map((row) => row.buyer_id)));
    const { data: buyerRows, error: buyerError } = await supabase
        .from('users')
        .select('id, first_name, last_name, avatar_url')
        .in('id', buyerIds);

    if (buyerError !== null) {
        throw new Error(buyerError.message);
    }

    const buyerNameById = new Map<number, { readonly name: string; readonly avatarUrl: string | null }>();
    for (const buyerRow of (buyerRows ?? []) as BuyerNameRow[]) {
        const firstName = buyerRow.first_name.trim();
        const lastName = buyerRow.last_name.trim();
        const fullName = `${firstName} ${lastName}`.trim();
        buyerNameById.set(buyerRow.id, {
            name: fullName.length > 0 ? fullName : 'Buyer',
            avatarUrl: buyerRow.avatar_url,
        });
    }

    return refundRows.map((row) => {
        const buyer = buyerNameById.get(row.buyer_id);
        return {
            uid: row.uid,
            orderItemUid: row.order_item_uid,
            buyerName: buyer?.name ?? 'Buyer',
            buyerAvatarUrl: buyer?.avatarUrl ?? null,
            productName: row.product_name,
            variantName: row.variant_name,
            refundAmount: row.refund_amount,
            reason: row.reason,
            evidenceImageUrls: row.evidence_image_urls,
            status: toRefundStatus(row.status),
            sellerResponse: row.seller_response,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at,
        } as SellerRefundRequestItem;
    });
}

async function fetchBuyerNotifications(userId: number): Promise<readonly AppNotificationItem[]> {
    const { data, error } = await supabase
        .from('app_notifications')
        .select('uid, title, message, notification_type, metadata, is_read, created_at')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false });

    if (error !== null) {
        throw new Error(error.message);
    }

    const rows = (data ?? []) as NotificationRow[];
    return rows.map((row) => ({
        uid: row.uid,
        title: row.title,
        message: row.message,
        type: row.notification_type,
        metadata: row.metadata,
        isRead: row.is_read,
        createdAt: row.created_at,
    }));
}

async function fetchBuyerCredits(userId: number): Promise<number> {
    const { data, error } = await supabase
        .from('buyer_credits')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

    if (error !== null) {
        throw new Error(error.message);
    }

    if (data === null) {
        return 0;
    }

    return (data as BuyerCreditsRow).balance;
}

export function useSellerRefundRequests(sellerUserId: number | null): UseQueryResult<readonly SellerRefundRequestItem[], Error> {
    return useQuery<readonly SellerRefundRequestItem[]>({
        queryKey: queryKeys.refunds.bySeller(sellerUserId ?? 0),
        queryFn: () => fetchSellerRefundRequests(sellerUserId ?? 0),
        enabled: sellerUserId !== null,
        staleTime: 30 * 1000,
    });
}

export function useBuyerNotifications(userId: number | null): UseQueryResult<readonly AppNotificationItem[], Error> {
    return useQuery<readonly AppNotificationItem[]>({
        queryKey: queryKeys.notifications(userId ?? 0),
        queryFn: () => fetchBuyerNotifications(userId ?? 0),
        enabled: userId !== null,
        staleTime: 20 * 1000,
    });
}

export function useBuyerCredits(userId: number | null): UseQueryResult<number, Error> {
    return useQuery<number>({
        queryKey: queryKeys.buyerCredits(userId ?? 0),
        queryFn: () => fetchBuyerCredits(userId ?? 0),
        enabled: userId !== null,
        staleTime: 30 * 1000,
    });
}

interface SubmitRefundRequestVariables {
    readonly orderItemUid: string;
    readonly reason: string;
    readonly evidenceImageUrls: readonly string[];
}

export function useSubmitRefundRequest(): UseMutationResult<string, Error, SubmitRefundRequestVariables> {
    const queryClient = useQueryClient();

    return useMutation<string, Error, SubmitRefundRequestVariables>({
        mutationFn: async ({ orderItemUid, reason, evidenceImageUrls }) => {
            const { data, error } = await supabase.rpc('submit_refund_request', {
                p_order_item_uid: orderItemUid,
                p_reason: reason,
                p_evidence_urls: [...evidenceImageUrls],
            });

            if (error !== null) {
                throw new Error(error.message);
            }

            if (typeof data !== 'string' || data.trim().length === 0) {
                throw new Error('Unable to create refund request.');
            }

            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
            void queryClient.invalidateQueries({ queryKey: ['refunds'] });
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}

interface ProcessRefundDecisionVariables {
    readonly refundUid: string;
    readonly decision: 'accepted' | 'rejected';
    readonly sellerResponse: string;
}

export function useProcessRefundDecision(): UseMutationResult<boolean, Error, ProcessRefundDecisionVariables> {
    const queryClient = useQueryClient();

    return useMutation<boolean, Error, ProcessRefundDecisionVariables>({
        mutationFn: async ({ refundUid, decision, sellerResponse }) => {
            const { data, error } = await supabase.rpc('process_refund_request_decision', {
                p_refund_uid: refundUid,
                p_decision: decision,
                p_seller_response: sellerResponse,
            });

            if (error !== null) {
                throw new Error(error.message);
            }

            if (data !== true) {
                throw new Error('Unable to process refund request.');
            }

            return true;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['orders'] });
            void queryClient.invalidateQueries({ queryKey: ['refunds'] });
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
            void queryClient.invalidateQueries({ queryKey: ['shop-analytics'] });
            void queryClient.invalidateQueries({ queryKey: ['buyerCredits'] });
        },
    });
}

export function useMarkNotificationRead(): UseMutationResult<boolean, Error, { readonly notificationUid: string }> {
    const queryClient = useQueryClient();

    return useMutation<boolean, Error, { readonly notificationUid: string }>({
        mutationFn: async ({ notificationUid }) => {
            const { error } = await supabase
                .from('app_notifications')
                .update({
                    is_read: true,
                    read_at: new Date().toISOString(),
                })
                .eq('uid', notificationUid)
                .eq('is_read', false);

            if (error !== null) {
                throw new Error(error.message);
            }

            return true;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}
