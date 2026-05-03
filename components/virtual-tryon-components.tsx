import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, Linking, Modal, StyleSheet, Text, View } from 'react-native';
import {
    deleteVtonHistoryRecord,
    getVtonHistory,
    VTON_DAILY_LIMIT,
    VTON_MONTHLY_LIMIT,
    VtonUsageLimits,
    VtonUsageRecord,
} from '../utils/database/vton-usage-table';
import { AnimatedActivityLoader } from './ui/animated-activity-loader';
import { ConfirmDialog } from './ui/confirm-dialog';
import { ImageWithFallback } from './ui/image-with-fallback';
import { LoadingModal } from './ui/loading-modal';
import { SkeletonLoader } from './ui/skeleton-loader';
import { useTheme } from './ui/theme-provider';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRY_ON_LOADER_DOTLOTTIE: number = require('../assets/lottie/animated-loader-def.lottie');

// ─── UsageLimitIndicator ──────────────────────────────────────────────────────

interface UsageLimitIndicatorProps {
    readonly limits: VtonUsageLimits;
}

/**
 * Displays daily and monthly virtual try-on usage progress bars.
 * Shown in the idle TryOnModal state so users know how many tries remain.
 */
export const UsageLimitIndicator: React.FC<UsageLimitIndicatorProps> = ({ limits }) => {
    const { theme } = useTheme();
    const dailyPct = Math.min(limits.dailyCount / VTON_DAILY_LIMIT, 1);
    const monthlyPct = Math.min(limits.monthlyCount / VTON_MONTHLY_LIMIT, 1);
    const dailyBarColor = dailyPct >= 1 ? theme.error : dailyPct >= 0.6 ? theme.warning : theme.success;
    const monthlyBarColor = monthlyPct >= 1 ? theme.error : monthlyPct >= 0.6 ? theme.warning : theme.success;

    return (
        <View style={[limitStyles.container, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[limitStyles.title, { color: theme.textPrimary }]}>Usage Limit</Text>
            {/* Daily */}
            <View style={limitStyles.row}>
                <Text style={[limitStyles.label, { color: theme.textSecondary }]}>Today</Text>
                <Text style={[limitStyles.count, { color: theme.textPrimary }]}>
                    {limits.dailyCount}/{VTON_DAILY_LIMIT}
                </Text>
            </View>
            <View style={[limitStyles.track, { backgroundColor: theme.border }]}>
                <View style={[limitStyles.fill, { width: `${dailyPct * 100}%`, backgroundColor: dailyBarColor }]} />
            </View>
            {/* Monthly */}
            <View style={[limitStyles.row, { marginTop: 10 }]}>
                <Text style={[limitStyles.label, { color: theme.textSecondary }]}>This Month</Text>
                <Text style={[limitStyles.count, { color: theme.textPrimary }]}>
                    {limits.monthlyCount}/{VTON_MONTHLY_LIMIT}
                </Text>
            </View>
            <View style={[limitStyles.track, { backgroundColor: theme.border }]}>
                <View style={[limitStyles.fill, { width: `${monthlyPct * 100}%`, backgroundColor: monthlyBarColor }]} />
            </View>
        </View>
    );
};

const limitStyles = StyleSheet.create({
    container: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
    title: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    label: { fontSize: 12 },
    count: { fontSize: 12, fontWeight: '700' },
    track: { height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
});

// ─── TryOnProgress ────────────────────────────────────────────────────────────

export type ReplicateStatus = 'starting' | 'processing';

interface TryOnProgressProps {
    readonly phase: 'uploading' | 'processing';
    readonly elapsedSeconds: number;
    /** Current status reported by Replicate. Only relevant when phase === 'processing'. */
    readonly replicateStatus: ReplicateStatus;
}

/**
 * Full-screen loader shown while the user photo uploads and while
 * the Replicate model generates the try-on result.
 */
export const TryOnProgress: React.FC<TryOnProgressProps> = ({
    phase, elapsedSeconds, replicateStatus,
}) => {
    const { theme } = useTheme();
    const loadingText = phase === 'uploading'
        ? 'Uploading your photo…'
        : replicateStatus === 'starting'
            ? 'Warming up AI model…'
            : 'Generating your look…';

    return (
        <View style={progressStyles.screen}>
            <View style={progressStyles.stack}>
                <AnimatedActivityLoader
                    src={TRY_ON_LOADER_DOTLOTTIE}
                    size={190}
                    style={progressStyles.loader}
                    accessibilityLabel="Virtual try-on loading"
                />
                <Text style={[progressStyles.message, { color: theme.textPrimary }]}>{loadingText}</Text>
                <Text style={[progressStyles.elapsed, { color: theme.textSecondary }]}>
                    {elapsedSeconds}s elapsed
                </Text>
            </View>
        </View>
    );
};

const progressStyles = StyleSheet.create({
    screen: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 12,
    },
    stack: { alignItems: 'center' },
    loader: { marginBottom: 16 },
    message: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
    elapsed: { fontSize: 13, textAlign: 'center', opacity: 0.7 },
});

// ─── TryOnResult ──────────────────────────────────────────────────────────────

interface TryOnResultProps {
    readonly resultUrl: string;
    readonly productName: string;
    readonly onTryAgain: () => void;
    readonly onClose: () => void;
    readonly onViewGallery: () => void;
}

/**
 * Displays the AI-generated virtual try-on result image.
 * "View Full Image" opens an in-app full-screen modal to avoid Android
 * browser-activity errors and keep the user inside the app.
 */
export const TryOnResult: React.FC<TryOnResultProps> = ({
    resultUrl, productName, onTryAgain, onClose, onViewGallery,
}) => {
    const { theme } = useTheme();
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [fsImageError, setFsImageError] = useState<boolean>(false);

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    return (
        <View style={resultStyles.container}>
            <Text style={[resultStyles.title, { color: theme.textPrimary }]}>Your Virtual Try-On</Text>
            <Text style={[resultStyles.subtitle, { color: theme.textSecondary }]}>"{productName}"</Text>

            {/* Thumbnail — overflow:hidden required for borderRadius on Android */}
            <RipplePressable
                activeOpacity={0.9}
                style={[resultStyles.imageWrapper, { backgroundColor: theme.border }]}
                onPress={() => { setFsImageError(false); setIsFullscreen(true); }}
            >
                <ImageWithFallback
                    uri={resultUrl}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                />
                <View style={[resultStyles.tapHint, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                    <Text style={resultStyles.tapHintText}>Tap to expand</Text>
                </View>
            </RipplePressable>

            <View style={resultStyles.btnColumn}>
                <RipplePressable
                    style={[resultStyles.primaryBtn, { backgroundColor: theme.primary }]}
                    onPress={() => { setFsImageError(false); setIsFullscreen(true); }}
                >
                    <Text style={[resultStyles.primaryBtnText, { color: theme.white }]}>🔍 View Full Image</Text>
                </RipplePressable>
                <View style={resultStyles.rowBtns}>
                    <RipplePressable style={[resultStyles.secondaryBtn, { borderColor: theme.primary }]} onPress={onTryAgain}>
                        <Text style={[resultStyles.secondaryBtnText, { color: theme.primary }]}>🔄 Try Again</Text>
                    </RipplePressable>
                    <RipplePressable style={[resultStyles.secondaryBtn, { borderColor: theme.border }]} onPress={onViewGallery}>
                        <Text style={[resultStyles.secondaryBtnText, { color: theme.textSecondary }]}>🗂️ My Try-ons</Text>
                    </RipplePressable>
                </View>
                <RipplePressable onPress={onClose}>
                    <Text style={[resultStyles.closeText, { color: theme.textSecondary }]}>Close</Text>
                </RipplePressable>
            </View>

            {/* Full-screen image modal */}
            <Modal
                visible={isFullscreen}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setIsFullscreen(false)}
            >
                <View style={[resultStyles.modalBg, { width: screenWidth, height: screenHeight }]}>
                    {!fsImageError ? (
                        <Image
                            source={{ uri: resultUrl }}
                            style={{ width: screenWidth, height: screenHeight }}
                            resizeMode="contain"
                            onError={() => setFsImageError(true)}
                        />
                    ) : (
                        <View style={resultStyles.fsErrorView}>
                            <Text style={resultStyles.fsErrorIcon}>🖼️</Text>
                            <Text style={resultStyles.fsErrorText}>Image failed to load</Text>
                        </View>
                    )}
                    <RipplePressable
                        style={resultStyles.modalClose}
                        onPress={() => setIsFullscreen(false)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Text style={resultStyles.modalCloseText}>✕</Text>
                    </RipplePressable>
                </View>
            </Modal>
        </View>
    );
};

const resultStyles = StyleSheet.create({
    container: { alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    subtitle: { fontSize: 13, marginBottom: 16 },
    imageWrapper: {
        width: '100%',
        height: 320,
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden', // required for borderRadius on Android
    },
    tapHint: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: 6,
        alignItems: 'center',
    },
    tapHintText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    btnColumn: { width: '100%', gap: 12 },
    primaryBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    primaryBtnText: { fontSize: 15, fontWeight: '700' },
    rowBtns: { flexDirection: 'row', gap: 10 },
    secondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
    secondaryBtnText: { fontSize: 13, fontWeight: '600' },
    closeText: { textAlign: 'center', fontSize: 14, marginTop: 4 },
    modalBg: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    modalClose: {
        position: 'absolute',
        top: 48,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    fsErrorView: { alignItems: 'center', gap: 10 },
    fsErrorIcon: { fontSize: 36 },
    fsErrorText: { color: '#aaa', fontSize: 14 },
});

// ─── TryOnImagePreview ───────────────────────────────────────────────────────

interface TryOnImagePreviewProps {
    readonly imageUri: string;
    readonly onCancel: () => void;
    readonly onProceed: () => void;
}

/**
 * Confirmation view shown after selecting an image from gallery.
 * Lets the user verify the chosen image before starting VTON processing.
 */
export const TryOnImagePreview: React.FC<TryOnImagePreviewProps> = ({
    imageUri,
    onCancel,
    onProceed,
}) => {
    const { theme } = useTheme();

    return (
        <View style={previewStyles.container}>
            <Text style={[previewStyles.title, { color: theme.textPrimary }]}>Use This Photo?</Text>
            <Text style={[previewStyles.subtitle, { color: theme.textSecondary }]}>Confirm your selected gallery image before running virtual try-on.</Text>
            <View style={[previewStyles.imageWrapper, { backgroundColor: theme.border }]}> 
                <ImageWithFallback
                    uri={imageUri}
                    style={previewStyles.image}
                    resizeMode="contain"
                />
            </View>

            <View style={previewStyles.actionRow}>
                <RipplePressable
                    style={[previewStyles.cancelBtn, { borderColor: theme.border }]}
                    onPress={onCancel}
                >
                    <Text style={[previewStyles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </RipplePressable>
                <RipplePressable
                    style={[previewStyles.proceedBtn, { backgroundColor: theme.primary }]}
                    onPress={onProceed}
                >
                    <Text style={[previewStyles.proceedText, { color: theme.white }]}>Proceed to VTON</Text>
                </RipplePressable>
            </View>
        </View>
    );
};

const previewStyles = StyleSheet.create({
    container: { flex: 1 },
    title: { fontSize: 19, fontWeight: '700', marginBottom: 4 },
    subtitle: { fontSize: 13, marginBottom: 14, lineHeight: 18 },
    imageWrapper: {
        width: '100%',
        height: 360,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    image: { width: '100%', height: '100%' },
    actionRow: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 13,
        alignItems: 'center',
    },
    cancelText: { fontSize: 14, fontWeight: '600' },
    proceedBtn: {
        flex: 1.2,
        borderRadius: 10,
        paddingVertical: 13,
        alignItems: 'center',
    },
    proceedText: { fontSize: 14, fontWeight: '700' },
});

// ─── TryOnGallery ─────────────────────────────────────────────────────────────

interface TryOnGalleryProps {
    readonly userId: number;
    readonly onClose: () => void;
}

interface ProductFolder {
    readonly productId: number;
    readonly productName: string;
    readonly thumbnailUrl: string | null;
    readonly records: readonly VtonUsageRecord[];
    readonly previewUrl: string | null;
    readonly latestUsedAt: string;
}

/**
 * Gallery showing the user's past virtual try-on results.
 * Tapping a thumbnail opens it in a full-screen in-app modal.
 */
export const TryOnGallery: React.FC<TryOnGalleryProps> = ({ userId, onClose }) => {
    const { theme } = useTheme();
    const [records, setRecords] = useState<VtonUsageRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [fullscreenRecord, setFullscreenRecord] = useState<VtonUsageRecord | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<VtonUsageRecord | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    useEffect(() => {
        const load = async (): Promise<void> => {
            setIsLoading(true);
            const history = await getVtonHistory(userId);
            setRecords(history);
            setIsLoading(false);
        };
        void load();
    }, [userId]);

    const productFolders = useMemo<readonly ProductFolder[]>(() => {
        const groupedByProduct = new Map<number, VtonUsageRecord[]>();

        records.forEach((record) => {
            const current = groupedByProduct.get(record.productId) ?? [];
            groupedByProduct.set(record.productId, [...current, record]);
        });

        return Array.from(groupedByProduct.entries())
            .map(([productId, groupedRecords]) => ({
                productId,
                productName: groupedRecords[0]?.productName?.trim().length
                    ? groupedRecords[0].productName
                    : `Product #${String(productId)}`,
                thumbnailUrl: groupedRecords[0]?.productThumbnailUrl ?? null,
                records: groupedRecords,
                previewUrl: groupedRecords[0]?.productThumbnailUrl ?? groupedRecords[0]?.resultUrl ?? null,
                latestUsedAt: groupedRecords[0]?.usedAt ?? '',
            }))
            .sort((a, b) => new Date(b.latestUsedAt).getTime() - new Date(a.latestUsedAt).getTime());
    }, [records]);

    const selectedProductRecords = useMemo<readonly VtonUsageRecord[]>(() => {
        if (selectedProductId === null) {
            return [];
        }
        return records.filter((record) => record.productId === selectedProductId);
    }, [records, selectedProductId]);

    const selectedProductName = useMemo<string>(() => {
        if (selectedProductRecords.length === 0) {
            return selectedProductId !== null ? `Product #${String(selectedProductId)}` : '';
        }

        const firstName = selectedProductRecords[0]?.productName?.trim() ?? '';
        if (firstName.length > 0) {
            return firstName;
        }

        return selectedProductId !== null ? `Product #${String(selectedProductId)}` : '';
    }, [selectedProductId, selectedProductRecords]);

    const openDeleteDialog = (record: VtonUsageRecord): void => {
        setDeleteTarget(record);
    };

    const handleConfirmDelete = async (): Promise<void> => {
        if (deleteTarget === null) return;

        setIsDeleting(true);

        try {
            await deleteVtonHistoryRecord(userId, deleteTarget);

            const nextRecords = records.filter((record) => record.uid !== deleteTarget.uid);
            setRecords(nextRecords);

            if (fullscreenRecord?.uid === deleteTarget.uid) {
                setFullscreenRecord(null);
            }

            if (
                selectedProductId !== null
                && !nextRecords.some((record) => record.productId === selectedProductId)
            ) {
                setSelectedProductId(null);
            }

            setDeleteTarget(null);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unable to delete image. Please try again.';
            AppAlert.alert('Delete Failed', message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownloadFullscreenImage = useCallback(async (): Promise<void> => {
        const targetUrl = fullscreenRecord?.resultUrl ?? null;

        if (targetUrl === null) {
            AppAlert.alert('Download Unavailable', 'No image URL found for this try-on result.');
            return;
        }

        try {
            const canOpenUrl = await Linking.canOpenURL(targetUrl);
            if (!canOpenUrl) {
                AppAlert.alert('Download Unavailable', 'Unable to open this image URL on your device.');
                return;
            }

            await Linking.openURL(targetUrl);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unable to open the image URL.';
            AppAlert.alert('Download Failed', message);
        }
    }, [fullscreenRecord?.resultUrl]);

    const renderEmpty = (): React.JSX.Element => (
        <View style={galleryStyles.empty}>
            <Text style={galleryStyles.emptyIcon}>👗</Text>
            <Text style={[galleryStyles.emptyText, { color: theme.textSecondary }]}>No try-ons yet</Text>
            <Text style={[galleryStyles.emptySubtext, { color: theme.textSecondary }]}>Your virtual try-on results will appear here</Text>
        </View>
    );

    const renderFolderEmpty = (): React.JSX.Element => (
        <View style={galleryStyles.empty}>
            <Text style={galleryStyles.emptyIcon}>🗂️</Text>
            <Text style={[galleryStyles.emptyText, { color: theme.textSecondary }]}>No images in this folder</Text>
            <RipplePressable
                style={[galleryStyles.backToFoldersBtn, { borderColor: theme.border }]}
                onPress={() => setSelectedProductId(null)}
            >
                <Text style={[galleryStyles.backToFoldersText, { color: theme.primary }]}>Back to folders</Text>
            </RipplePressable>
        </View>
    );

    return (
        <View style={galleryStyles.container}>
            <View style={galleryStyles.header}>
                {selectedProductId === null ? (
                    <Text style={[galleryStyles.title, { color: theme.textPrimary }]}>My Try-Ons</Text>
                ) : (
                    <View>
                        <Text style={[galleryStyles.title, { color: theme.textPrimary }]}>{selectedProductName}</Text>
                        <Text style={[galleryStyles.subtitle, { color: theme.textSecondary }]}>
                            {selectedProductRecords.length} generated image{selectedProductRecords.length === 1 ? '' : 's'}
                        </Text>
                    </View>
                )}

                <View style={galleryStyles.headerActions}>
                    {selectedProductId !== null && (
                        <RipplePressable onPress={() => setSelectedProductId(null)}>
                            <Text style={[galleryStyles.secondaryHeaderBtn, { color: theme.textSecondary }]}>Folders</Text>
                        </RipplePressable>
                    )}
                    <RipplePressable onPress={onClose}>
                        <Text style={[galleryStyles.closeBtn, { color: theme.primary }]}>Done</Text>
                    </RipplePressable>
                </View>
            </View>
            {isLoading ? (
                <View style={galleryStyles.skeletonGrid}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonLoader key={i} width="47%" height={200} borderRadius={10} />
                    ))}
                </View>
            ) : selectedProductId === null ? (
                <FlatList<ProductFolder>
                    key="vton-folders-list"
                    data={productFolders as ProductFolder[]}
                    keyExtractor={(item) => String(item.productId)}
                    contentContainerStyle={galleryStyles.list}
                    ListEmptyComponent={renderEmpty}
                    renderItem={({ item }) => (
                        <RipplePressable
                            style={[galleryStyles.folderCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                            onPress={() => setSelectedProductId(item.productId)}
                            activeOpacity={0.85}
                        >
                            <View style={[galleryStyles.folderPreview, { backgroundColor: theme.border }]}> 
                                {item.previewUrl !== null ? (
                                    <Image source={{ uri: item.previewUrl }} style={galleryStyles.folderPreviewImage} resizeMode="cover" />
                                ) : (
                                    <Text style={galleryStyles.folderPreviewIcon}>🖼️</Text>
                                )}
                            </View>
                            <View style={galleryStyles.folderMeta}>
                                <Text style={[galleryStyles.folderTitle, { color: theme.textPrimary }]}>{item.productName}</Text>
                                <Text style={[galleryStyles.folderSubtext, { color: theme.textSecondary }]}>
                                    {item.records.length} image{item.records.length === 1 ? '' : 's'}
                                </Text>
                                <Text style={[galleryStyles.folderSubtext, { color: theme.textSecondary }]}>
                                    Last try-on: {new Date(item.latestUsedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                </Text>
                            </View>
                        </RipplePressable>
                    )}
                />
            ) : (
                <FlatList<VtonUsageRecord>
                    key={`vton-images-list-${String(selectedProductId)}`}
                    data={selectedProductRecords as VtonUsageRecord[]}
                    keyExtractor={(item) => item.uid}
                    numColumns={2}
                    columnWrapperStyle={galleryStyles.row}
                    contentContainerStyle={galleryStyles.list}
                    ListEmptyComponent={renderFolderEmpty}
                    renderItem={({ item }) =>
                        item.resultUrl !== null ? (
                            <RipplePressable
                                style={galleryStyles.thumb}
                                onPress={() => setFullscreenRecord(item)}
                                activeOpacity={0.85}
                            >
                                {/* overflow:hidden required for borderRadius on Android */}
                                <View style={galleryStyles.thumbImgWrapper}>
                                    <Image
                                        source={{ uri: item.resultUrl }}
                                        style={galleryStyles.thumbImg}
                                        resizeMode="contain"
                                    />
                                    <RipplePressable
                                        style={galleryStyles.deleteThumbBtn}
                                        onPress={() => openDeleteDialog(item)}
                                    >
                                        <Text style={galleryStyles.deleteThumbText}>Delete</Text>
                                    </RipplePressable>
                                </View>
                                <Text style={[galleryStyles.thumbDate, { color: theme.textSecondary }]}>
                                    {new Date(item.usedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                </Text>
                            </RipplePressable>
                        ) : null
                    }
                />
            )}

            {/* Full-screen image modal */}
            <Modal
                visible={fullscreenRecord !== null}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setFullscreenRecord(null)}
            >
                <View style={[galleryStyles.modalBg, { width: screenWidth, height: screenHeight }]}>
                    {fullscreenRecord?.resultUrl !== null && fullscreenRecord !== null && (
                        <Image
                            source={{ uri: fullscreenRecord.resultUrl }}
                            style={{ width: screenWidth, height: screenHeight }}
                            resizeMode="contain"
                        />
                    )}
                    <View style={galleryStyles.modalActionRow}>
                        <RipplePressable
                            style={galleryStyles.modalDownload}
                            onPress={() => { void handleDownloadFullscreenImage(); }}
                        >
                            <Text style={galleryStyles.modalDownloadText}>Download</Text>
                        </RipplePressable>
                        {fullscreenRecord !== null && (
                            <RipplePressable
                                style={galleryStyles.modalDelete}
                                onPress={() => openDeleteDialog(fullscreenRecord)}
                            >
                                <Text style={galleryStyles.modalDeleteText}>Delete Image</Text>
                            </RipplePressable>
                        )}
                    </View>
                    <RipplePressable
                        style={galleryStyles.modalClose}
                        onPress={() => setFullscreenRecord(null)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Text style={galleryStyles.modalCloseText}>✕</Text>
                    </RipplePressable>
                </View>
            </Modal>

            <ConfirmDialog
                visible={deleteTarget !== null}
                title="Delete Image"
                message="Delete this generated try-on image? This action cannot be undone."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => { void handleConfirmDelete(); }}
            />

            <LoadingModal isVisible={isDeleting} message="Deleting image..." />
        </View>
    );
};

const galleryStyles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { fontSize: 17, fontWeight: '700' },
    subtitle: { fontSize: 12, marginTop: 2 },
    secondaryHeaderBtn: { fontSize: 13, fontWeight: '600' },
    closeBtn: { fontSize: 15, fontWeight: '600' },
    list: { flexGrow: 1 },
    row: { gap: 10, marginBottom: 10 },
    folderCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    folderPreview: {
        width: 70,
        height: 70,
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    folderPreviewImage: { width: '100%', height: '100%' },
    folderPreviewIcon: { fontSize: 26 },
    folderMeta: { flex: 1 },
    folderTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    folderSubtext: { fontSize: 12, lineHeight: 17 },
    thumb: { flex: 1 },
    thumbImgWrapper: { width: '100%', aspectRatio: 3 / 4, borderRadius: 10, overflow: 'hidden' },
    thumbImg: { width: '100%', height: '100%' },
    deleteThumbBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    deleteThumbText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    thumbDate: { fontSize: 11, textAlign: 'center', marginTop: 4 },
    empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyIcon: { fontSize: 40 },
    emptyText: { fontSize: 16, fontWeight: '600' },
    emptySubtext: { fontSize: 13, textAlign: 'center' },
    backToFoldersBtn: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    backToFoldersText: { fontSize: 13, fontWeight: '600' },
    skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    modalBg: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    modalActionRow: {
        position: 'absolute',
        bottom: 32,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    modalDownload: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    modalDownloadText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    modalDelete: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    modalDeleteText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    modalClose: {
        position: 'absolute',
        top: 48,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
