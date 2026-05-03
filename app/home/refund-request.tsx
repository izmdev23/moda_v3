import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { EmptyList } from '../../components/ui/empty-list';
import { LoadingModal } from '../../components/ui/loading-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useSubmitRefundRequest } from '../../hooks/use-refunds';
import { supabase } from '../../supabase/supabaseClient';
import { formatPrice } from '../../utils/utils';

interface RefundableOrderItemRow {
    readonly uid: string;
    readonly order_id: number;
    readonly product_id: number | null;
    readonly product_name: string;
    readonly variant_name: string;
    readonly total_price: number;
    readonly seller_shipping_status: string;
    readonly refund_status: string;
}

interface ProductThumbnailRow {
    readonly thumbnail_url: string;
}

interface RefundOrderItemDetails {
    readonly orderItemUid: string;
    readonly productName: string;
    readonly variantName: string;
    readonly totalPrice: number;
    readonly thumbnailUrl: string;
    readonly shippingStatus: string;
    readonly refundStatus: string;
}

const REFUND_EVIDENCE_BUCKET = 'refund-evidence';
const MAX_REFUND_IMAGES = 3;
const EMPTY_IMAGE_URL = '';

function resolveFileExtension(uri: string): string {
    const normalizedUri = uri.trim();
    const lastDotIndex = normalizedUri.lastIndexOf('.');

    if (lastDotIndex === -1) {
        return 'jpg';
    }

    const extension = normalizedUri.slice(lastDotIndex + 1).toLowerCase();
    if (extension === 'png' || extension === 'webp' || extension === 'jpeg' || extension === 'jpg') {
        return extension;
    }

    return 'jpg';
}

async function fetchRefundOrderItemDetails(orderItemUid: string): Promise<RefundOrderItemDetails | null> {
    const { data, error } = await supabase
        .from('order_items')
        .select('uid, order_id, product_id, product_name, variant_name, total_price, seller_shipping_status, refund_status')
        .eq('uid', orderItemUid)
        .maybeSingle();

    if (error !== null) {
        throw new Error(error.message);
    }

    if (data === null) {
        return null;
    }

    const orderItem = data as RefundableOrderItemRow;

    let thumbnailUrl = EMPTY_IMAGE_URL;
    if (orderItem.product_id !== null) {
        const { data: productData, error: productError } = await supabase
            .from('products')
            .select('thumbnail_url')
            .eq('id', orderItem.product_id)
            .maybeSingle();

        if (productError !== null) {
            throw new Error(productError.message);
        }

        thumbnailUrl = (productData as ProductThumbnailRow | null)?.thumbnail_url ?? EMPTY_IMAGE_URL;
    }

    return {
        orderItemUid: orderItem.uid,
        productName: orderItem.product_name,
        variantName: orderItem.variant_name,
        totalPrice: orderItem.total_price,
        thumbnailUrl,
        shippingStatus: orderItem.seller_shipping_status,
        refundStatus: orderItem.refund_status,
    };
}

export default function RefundRequestScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { orderItemUid } = useLocalSearchParams<{ orderItemUid?: string }>();
    const [reason, setReason] = useState<string>('');
    const [selectedImageUris, setSelectedImageUris] = useState<readonly string[]>([]);
    const [isConfirmDialogVisible, setIsConfirmDialogVisible] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const submitRefundRequestMutation = useSubmitRefundRequest();

    const normalizedOrderItemUid = typeof orderItemUid === 'string' ? orderItemUid : '';

    const { data: orderItemDetails, isLoading, refetch } = useQuery<RefundOrderItemDetails | null>({
        queryKey: ['refund-order-item-details', normalizedOrderItemUid],
        queryFn: () => fetchRefundOrderItemDetails(normalizedOrderItemUid),
        enabled: normalizedOrderItemUid.length > 0,
    });

    const isAlreadyRequested = useMemo(() => {
        const refundStatus = orderItemDetails?.refundStatus.trim().toLowerCase() ?? 'none';
        return refundStatus === 'pending' || refundStatus === 'accepted';
    }, [orderItemDetails]);

    const handlePickImage = useCallback(async (): Promise<void> => {
        if (selectedImageUris.length >= MAX_REFUND_IMAGES) {
            AppAlert.alert('Limit Reached', `You can upload up to ${MAX_REFUND_IMAGES} photos.`);
            return;
        }

        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            AppAlert.alert('Permission Required', 'Please allow gallery access to upload refund photos.');
            return;
        }

        const pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
        });

        if (pickerResult.canceled || pickerResult.assets.length === 0) {
            return;
        }

        setSelectedImageUris((previousUris) => {
            if (previousUris.length >= MAX_REFUND_IMAGES) {
                return previousUris;
            }

            const nextUris = [...previousUris, pickerResult.assets[0].uri];
            return nextUris.slice(0, MAX_REFUND_IMAGES);
        });
    }, [selectedImageUris.length]);

    const handleRemoveImage = useCallback((uriToRemove: string): void => {
        setSelectedImageUris((previousUris) => previousUris.filter((uri) => uri !== uriToRemove));
    }, []);

    const uploadRefundEvidenceImages = useCallback(async (): Promise<readonly string[]> => {
        if (selectedImageUris.length === 0) {
            return [];
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError !== null || sessionData.session === null) {
            throw new Error('Your session expired. Please sign in again.');
        }

        const authUserId = sessionData.session.user.id;
        const uploadedImageUrls: string[] = [];

        for (let index = 0; index < selectedImageUris.length; index += 1) {
            const localUri = selectedImageUris[index];
            const fileExtension = resolveFileExtension(localUri);
            const filePath = `${authUserId}/${normalizedOrderItemUid}/${Date.now()}-${index}.${fileExtension}`;

            const imageResponse = await fetch(localUri);
            const imageArrayBuffer = await imageResponse.arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from(REFUND_EVIDENCE_BUCKET)
                .upload(filePath, imageArrayBuffer, {
                    contentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
                    upsert: false,
                });

            if (uploadError !== null) {
                throw new Error(uploadError.message);
            }

            const { data: publicUrlData } = supabase.storage.from(REFUND_EVIDENCE_BUCKET).getPublicUrl(filePath);
            uploadedImageUrls.push(publicUrlData.publicUrl);
        }

        return uploadedImageUrls;
    }, [normalizedOrderItemUid, selectedImageUris]);

    const handleConfirmSubmit = useCallback(async (): Promise<void> => {
        if (orderItemDetails === null) {
            AppAlert.alert('Unavailable', 'This order item is not available for refund right now.');
            return;
        }

        if (orderItemDetails.shippingStatus.trim().toLowerCase() !== 'delivered') {
            AppAlert.alert('Unavailable', 'Only received items can be refunded.');
            return;
        }

        if (isAlreadyRequested) {
            AppAlert.alert('Refund Exists', 'This item already has a refund request.');
            return;
        }

        if (reason.trim().length < 10) {
            AppAlert.alert('Details Needed', 'Please describe the issue in at least 10 characters.');
            return;
        }

        setIsConfirmDialogVisible(false);
        setIsSubmitting(true);

        try {
            const evidenceImageUrls = await uploadRefundEvidenceImages();

            await submitRefundRequestMutation.mutateAsync({
                orderItemUid: orderItemDetails.orderItemUid,
                reason: reason.trim(),
                evidenceImageUrls,
            });

            AppAlert.alert('Refund Requested', 'Your refund request was sent to the seller for review.', [
                {
                    text: 'OK',
                    onPress: () => {
                        router.back();
                    },
                },
            ]);

            void refetch();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to submit refund request.';
            AppAlert.alert('Error', message);
        } finally {
            setIsSubmitting(false);
        }
    }, [isAlreadyRequested, orderItemDetails, reason, refetch, submitRefundRequestMutation, uploadRefundEvidenceImages]);

    if (isLoading) {
        return (
            <SafeScreen style={styles.container}>
                <View style={styles.loadingWrap}>
                    <SkeletonLoader width="100%" height={120} borderRadius={12} style={styles.loadingGap} />
                    <SkeletonLoader width="100%" height={150} borderRadius={12} style={styles.loadingGap} />
                    <SkeletonLoader width="100%" height={90} borderRadius={12} />
                </View>
            </SafeScreen>
        );
    }

    if (orderItemDetails === null) {
        return (
            <SafeScreen style={styles.container}>
                <EmptyList
                    icon={<MaterialIcons name="report" size={48} color={theme.textSecondary} />}
                    message="Order item not found"
                    submessage="Return to My Orders and select another item."
                />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={styles.container}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <RipplePressable onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={20} color={theme.primary} />
                </RipplePressable>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Request Refund</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.itemCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    {orderItemDetails.thumbnailUrl.length > 0 ? (
                        <Image source={{ uri: orderItemDetails.thumbnailUrl }} style={styles.itemImage} contentFit="cover" />
                    ) : (
                        <View style={[styles.itemImage, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                            <MaterialIcons name="image-not-supported" size={24} color={theme.textSecondary} />
                        </View>
                    )}
                    <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, { color: theme.textPrimary }]} numberOfLines={2}>
                            {orderItemDetails.productName}
                        </Text>
                        <Text style={[styles.itemVariant, { color: theme.textSecondary }]}>{orderItemDetails.variantName}</Text>
                        <Text style={[styles.itemAmount, { color: theme.primary }]}>{formatPrice(orderItemDetails.totalPrice)}</Text>
                    </View>
                </View>

                <View style={styles.sectionWrap}>
                    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Refund Reason</Text>
                    <TextInput
                        value={reason}
                        onChangeText={setReason}
                        multiline
                        numberOfLines={5}
                        maxLength={500}
                        editable={!isAlreadyRequested}
                        placeholder="Describe what issue you found with the item..."
                        placeholderTextColor={theme.textSecondary}
                        style={[
                            styles.reasonInput,
                            {
                                color: theme.textPrimary,
                                borderColor: theme.border,
                                backgroundColor: theme.cardBackground,
                            },
                            isAlreadyRequested && { opacity: 0.7 },
                        ]}
                    />
                    <Text style={[styles.helperText, { color: theme.textSecondary }]}>{reason.length}/500</Text>
                </View>

                <View style={styles.sectionWrap}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Evidence Photos</Text>
                        <Text style={[styles.helperText, { color: theme.textSecondary }]}>{selectedImageUris.length}/{MAX_REFUND_IMAGES}</Text>
                    </View>

                    <View style={styles.imagesWrap}>
                        {selectedImageUris.map((uri) => (
                            <View key={uri} style={styles.imagePreviewWrap}>
                                <Image source={{ uri }} style={styles.imagePreview} contentFit="cover" />
                                {!isAlreadyRequested && (
                                    <RipplePressable
                                        style={[styles.removeImageButton, { backgroundColor: theme.error }]}
                                        onPress={() => handleRemoveImage(uri)}
                                    >
                                        <MaterialIcons name="close" size={12} color={theme.white} />
                                    </RipplePressable>
                                )}
                            </View>
                        ))}

                        {!isAlreadyRequested && selectedImageUris.length < MAX_REFUND_IMAGES && (
                            <RipplePressable
                                style={[styles.addImageCard, { borderColor: theme.primary, backgroundColor: theme.cardBackground }]}
                                onPress={() => { void handlePickImage(); }}
                            >
                                <MaterialIcons name="add-a-photo" size={18} color={theme.primary} />
                                <Text style={[styles.addImageText, { color: theme.primary }]}>Add Photo</Text>
                            </RipplePressable>
                        )}
                    </View>
                </View>

                {isAlreadyRequested && (
                    <View style={[styles.infoBanner, { backgroundColor: `${theme.warning}1F`, borderColor: theme.warning }]}>
                        <MaterialIcons name="info-outline" size={16} color={theme.warning} />
                        <Text style={[styles.infoBannerText, { color: theme.warning }]}>This item already has a refund request in progress or completed.</Text>
                    </View>
                )}

                <RipplePressable
                    style={[
                        styles.submitButton,
                        { backgroundColor: theme.primary },
                        (isAlreadyRequested || reason.trim().length < 10) && styles.submitButtonDisabled,
                    ]}
                    disabled={isAlreadyRequested || reason.trim().length < 10}
                    onPress={() => setIsConfirmDialogVisible(true)}
                >
                    <Text style={[styles.submitButtonText, { color: theme.white }]}>Submit Refund Request</Text>
                </RipplePressable>
            </ScrollView>

            <ConfirmDialog
                visible={isConfirmDialogVisible}
                title="Submit Refund Request"
                message="This will send your reason and photos to the seller for review. Continue?"
                confirmLabel="Submit"
                cancelLabel="Cancel"
                variant="info"
                onConfirm={() => { void handleConfirmSubmit(); }}
                onCancel={() => setIsConfirmDialogVisible(false)}
            />

            <LoadingModal isVisible={isSubmitting} message="Submitting refund request..." />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingWrap: {
        padding: 16,
    },
    loadingGap: {
        marginBottom: 12,
    },
    header: {
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    backButton: {
        padding: 6,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    headerSpacer: {
        width: 28,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 28,
    },
    itemCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        flexDirection: 'row',
        marginBottom: 16,
    },
    itemImage: {
        width: 76,
        height: 76,
        borderRadius: 8,
    },
    itemInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between',
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
    },
    itemVariant: {
        fontSize: 13,
        marginTop: 4,
    },
    itemAmount: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 6,
    },
    sectionWrap: {
        marginBottom: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    reasonInput: {
        minHeight: 130,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingTop: 10,
        textAlignVertical: 'top',
        fontSize: 14,
    },
    helperText: {
        fontSize: 12,
    },
    imagesWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    imagePreviewWrap: {
        position: 'relative',
    },
    imagePreview: {
        width: 84,
        height: 84,
        borderRadius: 8,
    },
    removeImageButton: {
        position: 'absolute',
        right: -6,
        top: -6,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addImageCard: {
        width: 84,
        height: 84,
        borderRadius: 8,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    addImageText: {
        fontSize: 11,
        fontWeight: '600',
    },
    infoBanner: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    infoBannerText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '500',
    },
    submitButton: {
        marginTop: 8,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
});
