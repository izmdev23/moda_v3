import { supabase } from '../../supabase/supabaseClient';
import { vtonResultsBucket } from './vton-results-bucket';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum virtual try-ons per calendar day per user (enforced server-side too). */
export const VTON_DAILY_LIMIT = 5;

/** Maximum virtual try-ons per calendar month per user (enforced server-side too). */
export const VTON_MONTHLY_LIMIT = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VtonUsageRecord {
    readonly uid: string;
    readonly productId: number;
    readonly productName: string | null;
    readonly productThumbnailUrl: string | null;
    readonly resultUrl: string | null;
    readonly usedAt: string;
}

export interface VtonUsageLimits {
    readonly canUse: boolean;
    readonly dailyCount: number;
    readonly monthlyCount: number;
    readonly dailyResetAt: string;
    readonly monthlyResetAt: string;
    readonly limitType: 'daily' | 'monthly' | null;
}

const VTON_RESULTS_PUBLIC_URL_MARKER = '/storage/v1/object/public/vton-results/';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStart(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function getMonthStart(): string {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function getTomorrowStart(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function getNextMonthStart(): string {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Returns how many virtual try-ons the user has used today.
 * @param userId — internal numeric user ID
 */
export async function getVtonDailyCount(userId: number): Promise<number> {
    const { count } = await supabase
        .from('vton_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', getTodayStart());
    return count ?? 0;
}

/**
 * Returns how many virtual try-ons the user has used this calendar month.
 * @param userId — internal numeric user ID
 */
export async function getVtonMonthlyCount(userId: number): Promise<number> {
    const { count } = await supabase
        .from('vton_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', getMonthStart());
    return count ?? 0;
}

/**
 * Checks whether the user can perform another virtual try-on and returns
 * full limit context for display in the UI.
 * @param userId — internal numeric user ID
 */
export async function checkVtonLimits(userId: number): Promise<VtonUsageLimits> {
    const [daily, monthly] = await Promise.all([
        getVtonDailyCount(userId),
        getVtonMonthlyCount(userId),
    ]);

    const dailyExceeded = daily >= VTON_DAILY_LIMIT;
    const monthlyExceeded = monthly >= VTON_MONTHLY_LIMIT;

    return {
        canUse: !dailyExceeded && !monthlyExceeded,
        dailyCount: daily,
        monthlyCount: monthly,
        dailyResetAt: getTomorrowStart(),
        monthlyResetAt: getNextMonthStart(),
        limitType: monthlyExceeded ? 'monthly' : dailyExceeded ? 'daily' : null,
    };
}

/**
 * Fetches the most recent virtual try-on results for a given user.
 * Ordered newest-first. Used to populate the "My Try-ons" gallery.
 * @param userId — internal numeric user ID
 * @param limit  — optional maximum number of records to return
 */
export async function getVtonHistory(userId: number, limit?: number): Promise<VtonUsageRecord[]> {
    let query = supabase
        .from('vton_usage')
        .select('uid, product_id, result_image_url, created_at, products(name, thumbnail_url)')
        .eq('user_id', userId)
        .eq('status', 'success')
        .not('result_image_url', 'is', null)
        .order('created_at', { ascending: false });

    if (typeof limit === 'number') {
        query = query.limit(limit);
    }

    const { data } = await query;

    return (data ?? []).map((row) => {
        const productRelation = Array.isArray(row.products) ? row.products[0] : row.products;

        return {
            uid: row.uid as string,
            productId: row.product_id as number,
            productName: (productRelation?.name as string | undefined) ?? null,
            productThumbnailUrl: (productRelation?.thumbnail_url as string | undefined) ?? null,
            resultUrl: row.result_image_url as string | null,
            usedAt: row.created_at as string,
        };
    });
}

function getStoragePathFromResultUrl(resultUrl: string): string | null {
    const markerIndex = resultUrl.indexOf(VTON_RESULTS_PUBLIC_URL_MARKER);
    if (markerIndex < 0) return null;

    const pathStart = markerIndex + VTON_RESULTS_PUBLIC_URL_MARKER.length;
    const rawPath = resultUrl.slice(pathStart).split('?')[0] ?? '';
    if (rawPath.trim().length === 0) return null;

    return decodeURIComponent(rawPath);
}

/**
 * Permanently deletes a user's VTON history row and tries to remove the
 * corresponding image from Storage.
 */
export async function deleteVtonHistoryRecord(userId: number, record: VtonUsageRecord): Promise<void> {
    const { error } = await supabase
        .from('vton_usage')
        .delete()
        .eq('uid', record.uid)
        .eq('user_id', userId);

    if (error !== null) {
        throw new Error(`Failed to delete image: ${error.message}`);
    }

    if (record.resultUrl === null) return;

    const storagePath = getStoragePathFromResultUrl(record.resultUrl);
    if (storagePath === null) return;

    await vtonResultsBucket.delete([storagePath]);
}
