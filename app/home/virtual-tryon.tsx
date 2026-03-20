import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import {
    type ReplicateStatus,
    TryOnGallery,
    TryOnImagePreview,
    TryOnProgress,
    TryOnResult,
    UsageLimitIndicator,
} from '../../components/virtual-tryon-components';
import { supabase } from '../../supabase/supabaseClient';
import { vtonUserPhotosBucket } from '../../utils/database/vton-results-bucket';
import {
    checkVtonLimits,
    VTON_DAILY_LIMIT,
    VTON_MONTHLY_LIMIT,
    type VtonUsageLimits,
} from '../../utils/database/vton-usage-table';

// ─── Types ────────────────────────────────────────────────────────────────────

type TryOnStep = 'idle' | 'preview' | 'uploading' | 'processing' | 'result' | 'gallery' | 'error';
type SupportedVtonCategory = 'tops' | 'bottoms' | 'full_body';

const SUPPORTED_VTON_CATEGORIES: readonly SupportedVtonCategory[] = ['tops', 'bottoms', 'full_body'];
const VTON_CATEGORY_DISABLED_MESSAGE = 'Virtual try-on is only available for tops, bottoms, and full_body products.';

function isSupportedVtonCategory(category: string): category is SupportedVtonCategory {
    return SUPPORTED_VTON_CATEGORIES.includes(category as SupportedVtonCategory);
}

/** Returned by the `start` action. */
type StartResponse = {
    predictionId?: string;
    uid?: string;
    error?: string;
    limitType?: 'daily' | 'monthly';
};

/** Returned by the `check` action. */
type CheckResponse = {
    status: 'starting' | 'processing' | 'succeeded' | 'failed';
    resultUrl?: string | readonly string[] | { readonly url?: string; readonly href?: string };
    error?: string;
};

/** State stored while a prediction is in flight. */
type ActivePrediction = {
    predictionId: string;
    uid: string | null;
};

type PendingSelectedImage = {
    readonly uri: string;
    readonly mimeType: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often (ms) the client polls the edge function for prediction status. */
const POLL_INTERVAL_MS = 3_000;

/** Delay (ms) before the first poll after starting a prediction. */
const FIRST_POLL_DELAY_MS = 2_000;

const DEFAULT_VTON_LIMITS: VtonUsageLimits = {
    canUse: true,
    dailyCount: 0,
    monthlyCount: 0,
    dailyResetAt: '',
    monthlyResetAt: '',
    limitType: null,
};

function normalizeResultUrl(raw: CheckResponse['resultUrl']): string {
    if (typeof raw === 'string') {
        return raw.trim().replace(/^['"]|['"]$/g, '');
    }

    if (Array.isArray(raw)) {
        const first = raw.find((value) => typeof value === 'string' && value.trim().length > 0);
        return typeof first === 'string' ? first.trim().replace(/^['"]|['"]$/g, '') : '';
    }

    if (typeof raw === 'object' && raw !== null) {
        const obj = raw as { readonly url?: unknown; readonly href?: unknown };
        const candidate = typeof obj.url === 'string' ? obj.url : typeof obj.href === 'string' ? obj.href : '';
        if (typeof candidate === 'string') {
            return candidate.trim().replace(/^['"]|['"]$/g, '');
        }
    }

    return '';
}

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * Dedicated Virtual Try-On screen. Replaces the former TryOnModal to avoid
 * Android touch-interception issues between a transparent Modal and the native
 * image picker / gallery layers.
 *
 * Uses a two-phase async architecture:
 *  1. `start` — submits the Replicate prediction, returns immediately.
 *  2. `check` — polled every {@link POLL_INTERVAL_MS}ms by the client.
 *
 * Params (all strings per Expo Router):
 *   productId       – numeric product id as string
 *   productName     – display name of the product
 *   garmentImageUrl – URL of the garment image
 *   userId          – numeric user id as string, omitted when unauthenticated
 */
export default function VirtualTryOnScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const params = useLocalSearchParams<{
        productId: string;
        productName: string;
        garmentImageUrl: string;
        productCategory: string;
        userId: string;
    }>();

    const productId = parseInt(params.productId ?? '0', 10);
    const productName = params.productName ?? '';
    const garmentImageUrl = params.garmentImageUrl ?? '';
    const productCategory = params.productCategory ?? '';
    const userId = params.userId ? parseInt(params.userId, 10) : null;
    const isCategorySupported = isSupportedVtonCategory(productCategory);

    const [step, setStep] = useState<TryOnStep>('idle');
    const [limits, setLimits] = useState<VtonUsageLimits | null>(null);
    const [isLimitsLoading, setIsLimitsLoading] = useState<boolean>(true);
    const [resultUrl, setResultUrl] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [replicateStatus, setReplicateStatus] = useState<ReplicateStatus>('starting');
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const [pendingImage, setPendingImage] = useState<PendingSelectedImage | null>(null);
    const isGenerating = step === 'uploading' || step === 'processing';

    const isCancelled = useRef<boolean>(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const firstPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activePrediction = useRef<ActivePrediction | null>(null);
    const consecutiveErrors = useRef<number>(0);

    // ── Load usage limits on mount ─────────────────────────────────────────

    useEffect(() => {
        let isMounted = true;

        const load = async (): Promise<void> => {
            if (userId === null) {
                setIsLimitsLoading(false);
                return;
            }

            setIsLimitsLoading(true);

            try {
                const result = await checkVtonLimits(userId);
                if (!isMounted) return;
                setLimits(result);
            } catch {
                if (!isMounted) return;
                setLimits(DEFAULT_VTON_LIMITS);
            } finally {
                if (isMounted) setIsLimitsLoading(false);
            }
        };

        void load();
        return () => { isMounted = false; };
    }, [userId]);

    // ── Elapsed-seconds timer during uploading / processing ────────────────

    useEffect(() => {
        if (isGenerating) {
            setElapsedSeconds(0);
            timerRef.current = setInterval(() => {
                setElapsedSeconds((s) => s + 1);
            }, 1000);
        } else {
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        return () => {
            if (timerRef.current !== null) clearInterval(timerRef.current);
        };
    }, [isGenerating]);

    // ── Cleanup polling on unmount ─────────────────────────────────────────

    useEffect(() => {
        return () => {
            isCancelled.current = true;
            stopPolling();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Polling helpers ────────────────────────────────────────────────────

    const stopPolling = useCallback((): void => {
        if (pollIntervalRef.current !== null) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        if (firstPollRef.current !== null) {
            clearTimeout(firstPollRef.current);
            firstPollRef.current = null;
        }
        activePrediction.current = null;
    }, []);

    /**
     * Calls the `check` action once. Schedules no retries itself — the interval
     * handles that. Silently ignores transient network errors so a single failed
     * poll doesn't abort the whole session.
     */
    const pollOnce = useCallback(async (): Promise<void> => {
        const pred = activePrediction.current;
        if (pred === null || isCancelled.current) return;

        let data: CheckResponse | null = null;

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token ?? '';

            const { data: rawData, error } = await supabase.functions.invoke('virtual-tryon', {
                body: { action: 'check', predictionId: pred.predictionId, uid: pred.uid },
                headers: { Authorization: `Bearer ${token}` },
            });

            if (error !== null) {
                const context = (error as { context?: Response }).context;
                let detailedErrorMessage = error.message;

                if (context !== undefined) {
                    const bodyText = await context.text();
                    try {
                        const parsed = JSON.parse(bodyText) as { error?: unknown };
                        if (typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
                            detailedErrorMessage = parsed.error;
                        }
                    } catch {
                        if (bodyText.trim().length > 0) {
                            detailedErrorMessage = bodyText;
                        }
                    }
                    console.warn('[virtual-tryon] Poll error response:', {
                        status: context.status,
                        message: detailedErrorMessage,
                    });
                }

                consecutiveErrors.current += 1;
                if (consecutiveErrors.current >= 5) {
                    stopPolling();
                    setErrorMessage(detailedErrorMessage || 'Server error. Please try again.');
                    setStep('error');
                    return;
                }
                console.warn('[virtual-tryon] Poll error (attempt', consecutiveErrors.current, '):', detailedErrorMessage);
                return;
            }

            consecutiveErrors.current = 0;
            data = rawData as CheckResponse;
        } catch (err: unknown) {
            console.warn('[virtual-tryon] Poll exception:', err instanceof Error ? err.message : err);
            return;
        }

        if (isCancelled.current) return;

        if (data.status === 'succeeded') {
            stopPolling();
            const normalizedResultUrl = normalizeResultUrl(data.resultUrl);
            if (normalizedResultUrl.length === 0) {
                setErrorMessage('No result URL returned from server');
                setStep('error');
                return;
            }
            setResultUrl(normalizedResultUrl);
            setStep('result');
            if (userId !== null) {
                const updated = await checkVtonLimits(userId);
                setLimits(updated);
            }
            return;
        }

        if (data.status === 'failed') {
            stopPolling();
            setErrorMessage(data.error ?? 'Try-on generation failed');
            setStep('error');
            return;
        }

        // 'starting' or 'processing' — update label and keep polling
        setReplicateStatus(data.status as ReplicateStatus);
    }, [stopPolling, userId]);

    // ── Action handlers ────────────────────────────────────────────────────

    const handleBack = useCallback((): void => {
        isCancelled.current = true;
        stopPolling();
        setPendingImage(null);
        router.back();
    }, [stopPolling]);

    const handleImagePicked = useCallback(async (uri: string, mimeType: string): Promise<void> => {
        if (userId === null) return;

        if (!isCategorySupported) {
            Alert.alert('Virtual Try-On Unavailable', VTON_CATEGORY_DISABLED_MESSAGE);
            return;
        }

        isCancelled.current = false;

        // ── Upload phase ──────────────────────────────────────────────────

        setStep('uploading');
        setReplicateStatus('starting');

        let humanImageUrl: string;
        try {
            const path = `${userId}/${Date.now()}.jpg`;
            const { publicUrl } = await vtonUserPhotosBucket.upload(path, uri, mimeType);
            if (isCancelled.current) return;
            humanImageUrl = publicUrl;
        } catch (err: unknown) {
            console.error('[virtual-tryon] Upload phase error:', err);
            setErrorMessage(err instanceof Error ? err.message : 'Failed to upload photo');
            setStep('error');
            return;
        }

        // ── Start prediction ──────────────────────────────────────────────

        setStep('processing');

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token ?? '';

            const { data: rawData, error } = await supabase.functions.invoke('virtual-tryon', {
                body: {
                    action: 'start',
                    garmentImageUrl,
                    humanImageUrl,
                    garmentDescription: productName,
                    productCategory,
                    productId,
                },
                headers: { Authorization: `Bearer ${token}` },
            });

            if (isCancelled.current) return;

            if (error !== null) {
                // Log the full context if available
                const context = (error as { context?: Response }).context;
                if (context !== undefined) {
                    const body = await context.text();
                    console.error('[virtual-tryon] Start error:', { message: error.message, status: context.status, body });
                } else {
                    console.error('[virtual-tryon] Start error:', error);
                }
                throw new Error(error.message ?? 'Failed to start try-on');
            }

            const res = rawData as StartResponse;

            if (res.error) {
                let msg = res.error;
                if (res.limitType === 'daily') msg = `Daily limit reached (${VTON_DAILY_LIMIT}/day). Resets at midnight.`;
                if (res.limitType === 'monthly') msg = `Monthly limit reached (${VTON_MONTHLY_LIMIT}/month). Resets next month.`;
                setErrorMessage(msg);
                setStep('error');
                return;
            }

            if (!res.predictionId) {
                throw new Error('Server did not return a prediction ID');
            }

            // ── Begin polling ─────────────────────────────────────────────

            consecutiveErrors.current = 0;
            activePrediction.current = { predictionId: res.predictionId, uid: res.uid ?? null };

            // First poll after a short delay (model takes a moment to queue)
            firstPollRef.current = setTimeout(() => { void pollOnce(); }, FIRST_POLL_DELAY_MS);

            // Recurring poll
            pollIntervalRef.current = setInterval(() => { void pollOnce(); }, POLL_INTERVAL_MS);

        } catch (err: unknown) {
            if (isCancelled.current) return;
            console.error('[virtual-tryon] Processing phase error:', err);
            setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
            setStep('error');
        }
    }, [userId, isCategorySupported, garmentImageUrl, productName, productCategory, productId, pollOnce]);

    const pickImage = useCallback(async (useCamera: boolean): Promise<void> => {
        if (isLimitsLoading) return;

        if (!isCategorySupported) {
            Alert.alert('Virtual Try-On Unavailable', VTON_CATEGORY_DISABLED_MESSAGE);
            return;
        }

        const permResult = useCamera
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permResult.granted) {
            Alert.alert('Permission Required', `Please grant ${useCamera ? 'camera' : 'photo library'} access in settings.`);
            return;
        }

        // Defer past the current Fabric event-dispatch cycle so the native picker
        // can acquire touch handling cleanly (required with newArchEnabled: true).
        await new Promise<void>((resolve) => setTimeout(resolve, 50));

        const result = useCamera
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, exif: false })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, exif: false });

        if (result.canceled || result.assets.length === 0) return;

        const asset = result.assets[0];
        const mime = asset.mimeType ?? 'image/jpeg';
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

        if (!allowed.includes(mime.toLowerCase())) {
            Alert.alert('Invalid Image', 'Please select a JPG, PNG, or WEBP photo.');
            return;
        }

        if (useCamera) {
            void handleImagePicked(asset.uri, mime);
            return;
        }

        setPendingImage({ uri: asset.uri, mimeType: mime });
        setStep('preview');
    }, [handleImagePicked, isCategorySupported, isLimitsLoading]);

    const handleTryAgain = useCallback((): void => {
        stopPolling();
        setStep('idle');
        setResultUrl('');
        setErrorMessage('');
        setReplicateStatus('starting');
        setPendingImage(null);
    }, [stopPolling]);

    const canUse = limits?.canUse === true;
    const isPickerDisabled = isLimitsLoading || !isCategorySupported || (limits !== null && !canUse);

    // ── Render step content ──────────────────────────────────────────────────

    const renderContent = (): React.JSX.Element => {
        if (step === 'gallery' && userId !== null) {
            return <TryOnGallery userId={userId} onClose={() => setStep('idle')} />;
        }

        if (step === 'result') {
            return (
                <TryOnResult
                    resultUrl={resultUrl}
                    productName={productName}
                    onTryAgain={handleTryAgain}
                    onClose={handleBack}
                    onViewGallery={() => setStep('gallery')}
                />
            );
        }

        if (step === 'preview' && pendingImage !== null) {
            return (
                <TryOnImagePreview
                    imageUri={pendingImage.uri}
                    onCancel={() => {
                        setPendingImage(null);
                        setStep('idle');
                    }}
                    onProceed={() => {
                        const selected = pendingImage;
                        setPendingImage(null);
                        void handleImagePicked(selected.uri, selected.mimeType);
                    }}
                />
            );
        }

        if (isGenerating) {
            return (
                <TryOnProgress
                    phase={step}
                    elapsedSeconds={elapsedSeconds}
                    replicateStatus={replicateStatus}
                />
            );
        }

        if (step === 'error') {
            return (
                <View style={styles.errorView}>
                    <Text style={styles.errorIcon}>❌</Text>
                    <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>Try-On Failed</Text>
                    <Text style={[styles.errorMsg, { color: theme.textSecondary }]}>{errorMessage}</Text>
                    <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={handleTryAgain}>
                        <Text style={[styles.retryBtnText, { color: theme.white }]}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleBack}>
                        <Text style={[styles.supportText, { color: theme.textSecondary }]}>
                            Still having issues? Contact support.
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        // ── Idle ──
        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>👗 Virtual Try-On</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    See how "{productName}" looks on you using AI
                </Text>

                {!isCategorySupported && (
                    <View style={[styles.limitBanner, { backgroundColor: `${theme.warning}1A`, borderColor: theme.warning }]}>
                        <Text style={[styles.limitBannerText, { color: theme.warning }]}>{VTON_CATEGORY_DISABLED_MESSAGE}</Text>
                    </View>
                )}

                {isCategorySupported && isLimitsLoading ? (
                    <View
                        style={[
                            styles.usageLimitSkeleton,
                            { backgroundColor: theme.background, borderColor: theme.border },
                        ]}
                    >
                        <SkeletonLoader height={13} width="32%" style={{ marginBottom: 12 }} />
                        <View style={styles.usageSkeletonRow}>
                            <SkeletonLoader height={12} width="22%" />
                            <SkeletonLoader height={12} width="18%" />
                        </View>
                        <SkeletonLoader height={6} borderRadius={3} style={{ marginTop: 8, marginBottom: 12 }} />
                        <View style={styles.usageSkeletonRow}>
                            <SkeletonLoader height={12} width="30%" />
                            <SkeletonLoader height={12} width="20%" />
                        </View>
                        <SkeletonLoader height={6} borderRadius={3} style={{ marginTop: 8 }} />
                    </View>
                ) : isCategorySupported ? (
                    limits !== null && <UsageLimitIndicator limits={limits} />
                ) : null}

                {isCategorySupported && limits !== null && !canUse && (
                    <View style={[styles.limitBanner, { backgroundColor: `${theme.error}1A`, borderColor: theme.error }]}>
                        <Text style={[styles.limitBannerText, { color: theme.error }]}>
                            {limits.limitType === 'daily'
                                ? 'Daily limit reached. Resets at midnight.'
                                : 'Monthly limit reached. Resets on the 1st.'}
                        </Text>
                    </View>
                )}

                {userId !== null && isCategorySupported && (
                    <>
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <View style={styles.pickerContainer}>
                            <Text style={[styles.guideTitle, { color: theme.textPrimary }]}>Photo Guidelines</Text>
                            {[
                                '🧍 Stand upright, facing the camera',
                                '📸 Full body visible from head to toe',
                                '💡 Good lighting, clear background',
                                '👕 Avoid heavy layering or accessories',
                            ].map((tip, i) => (
                                <Text key={i} style={[styles.guideTip, { color: theme.textSecondary }]}>{tip}</Text>
                            ))}
                            <View style={styles.pickerBtnRow}>
                                <TouchableOpacity
                                    style={[styles.pickBtn, { backgroundColor: theme.primary }, isPickerDisabled && styles.btnDisabled]}
                                    onPress={() => void pickImage(true)}
                                    disabled={isPickerDisabled}
                                >
                                    <Text style={[styles.pickBtnText, { color: theme.white }]}>📷 Camera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.pickBtn, { borderColor: theme.primary, borderWidth: 1.5 }, isPickerDisabled && styles.btnDisabled]}
                                    onPress={() => void pickImage(false)}
                                    disabled={isPickerDisabled}
                                >
                                    <Text style={[styles.pickBtnText, { color: theme.primary }]}>🖼️ Gallery</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                )}

                {userId !== null && (
                    <TouchableOpacity
                        style={[styles.galleryBtn, { borderColor: theme.border }]}
                        onPress={() => setStep('gallery')}
                    >
                        <Text style={[styles.galleryBtnText, { color: theme.primary }]}>🗂️ View My Past Try-ons</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        );
    };

    return (
        <SafeScreen>
            {!isGenerating && (
                <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={
                            step === 'gallery'
                                ? () => setStep('idle')
                                : step === 'preview'
                                    ? () => {
                                        setPendingImage(null);
                                        setStep('idle');
                                    }
                                    : handleBack
                        }
                    >
                        <Text style={[styles.backBtnText, { color: theme.primary }]}>‹ Back</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Virtual Try-On</Text>
                    <View style={styles.backBtn} />
                </View>
            )}

            <View style={[styles.content, isGenerating && styles.contentGenerating]}>
                {renderContent()}
            </View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backBtn: { width: 60 },
    backBtnText: { fontSize: 17, fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    content: { flex: 1, padding: 20 },
    contentGenerating: { padding: 0 },
    scrollContent: { paddingBottom: 32 },
    title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
    subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
    usageLimitSkeleton: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
    usageSkeletonRow: { flexDirection: 'row', justifyContent: 'space-between' },
    divider: { height: 1, marginVertical: 16 },
    pickerContainer: { paddingVertical: 8 },
    guideTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
    guideTip: { fontSize: 13, marginBottom: 6, lineHeight: 18 },
    pickerBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    pickBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
    btnDisabled: { opacity: 0.4 },
    pickBtnText: { fontSize: 15, fontWeight: '700' },
    limitBanner: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12 },
    limitBannerText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
    galleryBtn: { paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', marginTop: 16 },
    galleryBtnText: { fontSize: 14, fontWeight: '600' },
    errorView: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 16 },
    errorIcon: { fontSize: 40, marginBottom: 12 },
    errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
    errorMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    retryBtn: { paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12, marginBottom: 12 },
    retryBtnText: { fontSize: 15, fontWeight: '700' },
    supportText: { fontSize: 12, textDecorationLine: 'underline', textAlign: 'center' },
});
