import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ReviewImageUploader } from '../../components/review-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ImageWithFallback } from '../../components/ui/image-with-fallback';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { supabase } from '../../supabase/supabaseClient';
import { queryKeys } from '../../utils/query-keys';

interface ProductLookupRow {
    readonly id: number;
    readonly uid: string;
    readonly name: string;
    readonly thumbnail_url: string;
}

interface OrderItemLookupRow {
    readonly product_id: number | null;
}

interface ReviewLookupRow {
    readonly id: number;
    readonly uid: string;
    readonly review_text: string;
}

interface RatingLookupRow {
    readonly uid: string;
    readonly rating: number;
}

interface ReviewImageLookupRow {
    readonly image_url: string;
}

interface ResolvedProduct {
    readonly id: number;
    readonly uid: string;
    readonly name: string;
    readonly thumbnailUrl: string;
}

interface ExistingReviewState {
    readonly id: number;
    readonly uid: string;
}

const REVIEW_IMAGES_BUCKET = 'review-images';

function parseValidRating(value: string): number | null {
    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue)) {
        return null;
    }

    if (parsedValue < 1 || parsedValue > 5) {
        return null;
    }

    return parsedValue;
}

function resolveFileExtension(uri: string): string {
    const trimmedUri = uri.trim();
    const dotIndex = trimmedUri.lastIndexOf('.');
    if (dotIndex === -1) {
        return 'jpg';
    }

    const extension = trimmedUri.slice(dotIndex + 1).toLowerCase();
    if (extension === 'png' || extension === 'webp' || extension === 'jpeg' || extension === 'jpg') {
        return extension;
    }

    return 'jpg';
}

export default function ReviewFormScreen(): React.JSX.Element {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { theme } = useTheme();
    const { data: currentUser } = useCurrentUser();
    const {
        productUid,
        orderItemUid,
        initialRating,
        product_id,
        productId,
        existingReviewUid,
    } = useLocalSearchParams<{
        productUid?: string;
        orderItemUid?: string;
        initialRating?: string;
        product_id?: string;
        productId?: string;
        existingReviewUid?: string;
    }>();

    const [loading, setLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [confirmVisible, setConfirmVisible] = useState<boolean>(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState<boolean>(false);
    const [resolvedProduct, setResolvedProduct] = useState<ResolvedProduct | null>(null);
    const [existingReview, setExistingReview] = useState<ExistingReviewState | null>(null);

    const [productName, setProductName] = useState<string>('Loading product...');
    const [productImage, setProductImage] = useState<string>('');

    const [rating, setRating] = useState<number>(0);
    const [reviewText, setReviewText] = useState<string>('');
    const [images, setImages] = useState<string[]>([]);

    const normalizedOrderItemUid = typeof orderItemUid === 'string' ? orderItemUid.trim() : '';
    const normalizedProductUid = typeof productUid === 'string' ? productUid.trim() : '';
    const normalizedExistingReviewUid = typeof existingReviewUid === 'string' ? existingReviewUid.trim() : '';
    const normalizedProductId = typeof productId === 'string'
        ? Number(productId)
        : typeof product_id === 'string'
            ? Number(product_id)
            : Number.NaN;
    const prefilledRating = useMemo(() => {
        if (typeof initialRating !== 'string') {
            return null;
        }

        return parseValidRating(initialRating);
    }, [initialRating]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (currentUser === null || currentUser === undefined) {
                setLoading(false);
                return;
            }

            try {
                let productIdToResolve: number | null = Number.isInteger(normalizedProductId) && normalizedProductId > 0
                    ? normalizedProductId
                    : null;
                let productUidToResolve: string | null = normalizedProductUid.length > 0
                    ? normalizedProductUid
                    : null;

                if (productIdToResolve === null && productUidToResolve === null && normalizedOrderItemUid.length > 0) {
                    const { data: orderItemData, error: orderItemError } = await supabase
                        .from('order_items')
                        .select('product_id')
                        .eq('uid', normalizedOrderItemUid)
                        .maybeSingle();

                    if (orderItemError !== null) {
                        throw new Error(orderItemError.message);
                    }

                    const orderItem = orderItemData as OrderItemLookupRow | null;
                    productIdToResolve = orderItem?.product_id ?? null;
                }

                let productRow: ProductLookupRow | null = null;

                if (productUidToResolve !== null && productUidToResolve.length > 0) {
                    const { data: productData, error: productError } = await supabase
                        .from('products')
                        .select('id, uid, name, thumbnail_url')
                        .eq('uid', productUidToResolve)
                        .is('deleted_at', null)
                        .maybeSingle();

                    if (productError !== null) {
                        throw new Error(productError.message);
                    }

                    productRow = productData as ProductLookupRow | null;
                } else if (productIdToResolve !== null) {
                    const { data: productData, error: productError } = await supabase
                        .from('products')
                        .select('id, uid, name, thumbnail_url')
                        .eq('id', productIdToResolve)
                        .is('deleted_at', null)
                        .maybeSingle();

                    if (productError !== null) {
                        throw new Error(productError.message);
                    }

                    productRow = productData as ProductLookupRow | null;
                }

                if (productRow === null) {
                    throw new Error('Unable to locate this product.');
                }

                const nextProduct: ResolvedProduct = {
                    id: productRow.id,
                    uid: productRow.uid,
                    name: productRow.name,
                    thumbnailUrl: productRow.thumbnail_url,
                };

                setResolvedProduct(nextProduct);
                setProductName(nextProduct.name);
                setProductImage(nextProduct.thumbnailUrl);

                const [reviewResult, ratingResult] = await Promise.all([
                    supabase
                        .from('reviews')
                        .select('id, uid, review_text')
                        .eq('product_id', nextProduct.id)
                        .eq('user_id', currentUser.id)
                        .maybeSingle(),
                    supabase
                        .from('ratings')
                        .select('uid, rating')
                        .eq('product_id', nextProduct.id)
                        .eq('user_id', currentUser.id)
                        .maybeSingle(),
                ]);

                if (reviewResult.error !== null) {
                    throw new Error(reviewResult.error.message);
                }

                if (ratingResult.error !== null) {
                    throw new Error(ratingResult.error.message);
                }

                const existingReview = reviewResult.data as ReviewLookupRow | null;
                const existingRating = ratingResult.data as RatingLookupRow | null;

                if (existingReview !== null) {
                    setExistingReview({ id: existingReview.id, uid: existingReview.uid });
                    setReviewText(existingReview.review_text);

                    const { data: reviewImageData, error: reviewImageError } = await supabase
                        .from('review_images')
                        .select('image_url')
                        .eq('review_id', existingReview.id)
                        .order('sort_order', { ascending: true });

                    if (reviewImageError !== null) {
                        throw new Error(reviewImageError.message);
                    }

                    const reviewImages = (reviewImageData ?? []) as ReviewImageLookupRow[];
                    setImages(reviewImages.map((reviewImage) => reviewImage.image_url));
                }

                if (existingRating !== null) {
                    setRating(existingRating.rating);
                } else if (prefilledRating !== null) {
                    setRating(prefilledRating);
                }
            } catch (error) {
                console.error("Failed to load review details:", error);
                const message = error instanceof Error ? error.message : 'Unable to load this review form.';
                AppAlert.alert('Error', message, [{ text: 'OK', onPress: () => router.back() }]);
            } finally {
                setLoading(false);
            }
        };

        void loadInitialData();
    }, [currentUser, normalizedExistingReviewUid, normalizedOrderItemUid, normalizedProductId, normalizedProductUid, prefilledRating, router]);

    const handleAddImage = (uri: string): void => {
        setImages((prev) => [...prev, uri]);
    };

    const handleRemoveImage = (index: number): void => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmitPress = (): void => {
        if (rating === 0) {
            AppAlert.alert('Required', 'Please select a star rating.');
            return;
        }
        if (reviewText.trim().length === 0) {
            AppAlert.alert('Required', 'Please write a review text.');
            return;
        }

        setConfirmVisible(true);
    };

    const uploadReviewImages = useCallback(async (authUid: string, reviewUid: string): Promise<string[]> => {
        if (images.length === 0) {
            return [];
        }

        const uploadedImageUrls: string[] = [];

        for (let index = 0; index < images.length; index += 1) {
            const imageUri = images[index];

            if (/^https?:\/\//i.test(imageUri)) {
                uploadedImageUrls.push(imageUri);
                continue;
            }

            const extension = resolveFileExtension(imageUri);
            const filePath = `${authUid}/${reviewUid}/${Date.now()}-${index}.${extension}`;

            const imageResponse = await fetch(imageUri);
            const imageArrayBuffer = await imageResponse.arrayBuffer();

            const { error: uploadError } = await supabase.storage
                .from(REVIEW_IMAGES_BUCKET)
                .upload(filePath, imageArrayBuffer, {
                    contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
                    upsert: false,
                });

            if (uploadError !== null) {
                throw new Error(uploadError.message);
            }

            const { data: publicUrlData } = supabase.storage.from(REVIEW_IMAGES_BUCKET).getPublicUrl(filePath);
            uploadedImageUrls.push(publicUrlData.publicUrl);
        }

        return uploadedImageUrls;
    }, [images]);

    const submitReview = async (): Promise<void> => {
        setConfirmVisible(false);
        setIsSubmitting(true);

        try {
            if (resolvedProduct === null) {
                throw new Error('Product is unavailable for review.');
            }

            if (currentUser === null) {
                router.replace('/auth/login');
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.replace('/auth/login');
                return;
            }

            const { data: existingRating, error: existingRatingError } = await supabase
                .from('ratings')
                .select('uid')
                .eq('product_id', resolvedProduct.id)
                .eq('user_id', currentUser.id)
                .maybeSingle();

            if (existingRatingError !== null) {
                throw new Error(existingRatingError.message);
            }

            if (existingRating !== null) {
                const { error: updateRatingError } = await supabase
                    .from('ratings')
                    .update({ rating, review: reviewText.trim() })
                    .eq('uid', existingRating.uid);

                if (updateRatingError !== null) {
                    throw new Error(updateRatingError.message);
                }
            } else {
                const { error: insertRatingError } = await supabase
                    .from('ratings')
                    .insert({
                        user_id: currentUser.id,
                        product_id: resolvedProduct.id,
                        rating,
                        review: reviewText.trim(),
                    });

                if (insertRatingError !== null) {
                    throw new Error(insertRatingError.message);
                }
            }

            const { data: existingReview, error: existingReviewError } = await supabase
                .from('reviews')
                .select('id, uid')
                .eq('product_id', resolvedProduct.id)
                .eq('user_id', currentUser.id)
                .maybeSingle();

            if (existingReviewError !== null) {
                throw new Error(existingReviewError.message);
            }

            let reviewId: number;
            let reviewUid: string;

            if (existingReview !== null) {
                const { error: updateReviewError } = await supabase
                    .from('reviews')
                    .update({ review_text: reviewText.trim() })
                    .eq('id', existingReview.id);

                if (updateReviewError !== null) {
                    throw new Error(updateReviewError.message);
                }

                reviewId = existingReview.id;
                reviewUid = existingReview.uid;
            } else {
                const { data: insertedReview, error: insertReviewError } = await supabase
                    .from('reviews')
                    .insert({
                        user_id: currentUser.id,
                        product_id: resolvedProduct.id,
                        review_text: reviewText.trim(),
                    })
                    .select('id, uid')
                    .single();

                if (insertReviewError !== null) {
                    throw new Error(insertReviewError.message);
                }

                reviewId = insertedReview.id;
                reviewUid = insertedReview.uid;
            }

            const uploadedImageUrls = await uploadReviewImages(session.user.id, reviewUid);

            const { error: deleteReviewImagesError } = await supabase
                .from('review_images')
                .delete()
                .eq('review_id', reviewId);

            if (deleteReviewImagesError !== null) {
                throw new Error(deleteReviewImagesError.message);
            }

            if (uploadedImageUrls.length > 0) {
                const rowsToInsert = uploadedImageUrls.map((imageUrl, index) => ({
                    review_id: reviewId,
                    image_url: imageUrl,
                    sort_order: index,
                }));

                const { error: insertReviewImagesError } = await supabase
                    .from('review_images')
                    .insert(rowsToInsert);

                if (insertReviewImagesError !== null) {
                    throw new Error(insertReviewImagesError.message);
                }
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.products.byUid(resolvedProduct.uid) }),
                queryClient.invalidateQueries({ queryKey: ['products'] }),
                queryClient.invalidateQueries({ queryKey: queryKeys.productRatings(resolvedProduct.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.productRatingAverage(resolvedProduct.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.userRating(resolvedProduct.id, currentUser.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.reviews(resolvedProduct.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.myReview(resolvedProduct.id, currentUser.id) }),
                queryClient.refetchQueries({ queryKey: queryKeys.products.byUid(resolvedProduct.uid), type: 'all' }),
                queryClient.refetchQueries({ queryKey: ['products'], type: 'all' }),
                queryClient.refetchQueries({ queryKey: queryKeys.productRatings(resolvedProduct.id), type: 'all' }),
                queryClient.refetchQueries({ queryKey: queryKeys.productRatingAverage(resolvedProduct.id), type: 'all' }),
                queryClient.refetchQueries({ queryKey: queryKeys.myReview(resolvedProduct.id, currentUser.id), type: 'all' }),
            ]);

            AppAlert.alert('Success', existingReview !== null ? 'Your review has been updated successfully.' : 'Your review has been submitted successfully.', [
                { text: 'OK', onPress: () => router.back() }
            ]);

        } catch (error) {
            console.error('Submit review error:', error);
            AppAlert.alert('Error', 'Could not submit your review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteReview = async (): Promise<void> => {
        setDeleteConfirmVisible(false);

        if (resolvedProduct === null || currentUser === null || existingReview === null) {
            return;
        }

        setIsSubmitting(true);
        try {
            const { error: deleteImagesError } = await supabase
                .from('review_images')
                .delete()
                .eq('review_id', existingReview.id);

            if (deleteImagesError !== null) {
                throw new Error(deleteImagesError.message);
            }

            const { error: deleteReviewError } = await supabase
                .from('reviews')
                .delete()
                .eq('id', existingReview.id)
                .eq('user_id', currentUser.id);

            if (deleteReviewError !== null) {
                throw new Error(deleteReviewError.message);
            }

            const { error: deleteRatingError } = await supabase
                .from('ratings')
                .delete()
                .eq('product_id', resolvedProduct.id)
                .eq('user_id', currentUser.id);

            if (deleteRatingError !== null) {
                throw new Error(deleteRatingError.message);
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.products.byUid(resolvedProduct.uid) }),
                queryClient.invalidateQueries({ queryKey: ['products'] }),
                queryClient.invalidateQueries({ queryKey: queryKeys.productRatings(resolvedProduct.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.productRatingAverage(resolvedProduct.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.userRating(resolvedProduct.id, currentUser.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.reviews(resolvedProduct.id) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.myReview(resolvedProduct.id, currentUser.id) }),
                queryClient.refetchQueries({ queryKey: queryKeys.products.byUid(resolvedProduct.uid), type: 'all' }),
                queryClient.refetchQueries({ queryKey: ['products'], type: 'all' }),
                queryClient.refetchQueries({ queryKey: queryKeys.productRatings(resolvedProduct.id), type: 'all' }),
                queryClient.refetchQueries({ queryKey: queryKeys.productRatingAverage(resolvedProduct.id), type: 'all' }),
            ]);

            AppAlert.alert('Success', 'Your review has been deleted.', [{ text: 'OK', onPress: () => router.back() }]);
        } catch (error) {
            console.error('Delete review error:', error);
            AppAlert.alert('Error', 'Could not delete your review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEditing = existingReview !== null || normalizedExistingReviewUid.length > 0;
    const reviewScreenTitle = isEditing ? 'Edit Review' : 'Write a Review';
    const submitButtonLabel = isEditing ? 'Update Review' : 'Submit Review';
    const submitConfirmTitle = isEditing ? 'Update Review' : 'Submit Review';
    const submitConfirmMessage = isEditing
        ? 'Are you sure you want to update this review? It will be publicly visible.'
        : 'Are you sure you want to submit this review? It will be publicly visible.';

    return (
        <SafeScreen>
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <RipplePressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </RipplePressable>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{reviewScreenTitle}</Text>
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {loading ? (
                    <View>
                        <View style={[styles.productBanner, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <SkeletonLoader width={60} height={60} borderRadius={8} />
                            <View style={styles.productInfo}>
                                <SkeletonLoader width="70%" height={14} style={{ marginBottom: 8 }} />
                                <SkeletonLoader width="45%" height={12} />
                            </View>
                        </View>

                        <View style={styles.formSection}>
                            <SkeletonLoader width={96} height={14} style={{ marginBottom: 12 }} />
                            <View style={styles.starsContainer}>
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <SkeletonLoader key={`star-skeleton-${index}`} width={32} height={32} borderRadius={16} />
                                ))}
                            </View>

                            <SkeletonLoader width={92} height={14} style={{ marginBottom: 12 }} />
                            <SkeletonLoader width="100%" height={140} borderRadius={12} />
                        </View>

                        <SkeletonLoader width="100%" height={110} borderRadius={12} />

                        <View style={styles.submitButton}>
                            <SkeletonLoader width="100%" height={50} borderRadius={12} />
                        </View>
                    </View>
                ) : (
                    <>
                        <View style={[styles.productBanner, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <ImageWithFallback uri={productImage} style={styles.productImage} />
                            <View style={styles.productInfo}>
                                <Text style={[styles.productName, { color: theme.textPrimary }]} numberOfLines={2}>{productName}</Text>
                                <Text style={[styles.productSubtitle, { color: theme.textSecondary }]}>Rate your purchase</Text>
                            </View>
                        </View>

                        {/* Rating Input and Star Visuals */}
                        <View style={styles.formSection}>
                            <Text style={[styles.label, { color: theme.textPrimary }]}>Your Rating</Text>
                            <View style={styles.starsContainer}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <RipplePressable key={star} onPress={() => setRating(star)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}>
                                        <Ionicons
                                            name={star <= rating ? 'star' : 'star-outline'}
                                            size={40}
                                            color={star <= rating ? theme.starColor : theme.border}
                                        />
                                    </RipplePressable>
                                ))}
                            </View>

                            <Text style={[styles.label, { color: theme.textPrimary }]}>Your Review</Text>
                            <View style={[styles.inputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                                <React.Fragment>
                                    {/* We use standard TextInput, manually bound for flexibility in screen layer without complex wrappers */}
                                    <TextInput
                                        style={[styles.input, { color: theme.textPrimary }]}
                                        value={reviewText}
                                        onChangeText={setReviewText}
                                        placeholder="What did you like or dislike?"
                                        placeholderTextColor={theme.gray}
                                        multiline
                                        numberOfLines={5}
                                        maxLength={500}
                                        textAlignVertical="top"
                                    />
                                </React.Fragment>
                            </View>
                            <Text style={[styles.charCount, { color: theme.textSecondary }]}>{reviewText.length}/500</Text>
                        </View>

                        {/* Image Uploader */}
                        <ReviewImageUploader
                            images={images}
                            onAddImage={handleAddImage}
                            onRemoveImage={handleRemoveImage}
                            maxImages={3}
                        />

                        <RipplePressable
                            style={[styles.submitButton, { backgroundColor: theme.primary }, isSubmitting && styles.submitButtonDisabled]}
                            onPress={handleSubmitPress}
                            disabled={isSubmitting}
                            activeOpacity={0.8}
                        >
                            {isSubmitting ? (
                                <LoadingIndicator message="" />
                            ) : (
                                <Text style={[styles.submitButtonText, { color: theme.white }]}>{submitButtonLabel}</Text>
                            )}
                        </RipplePressable>

                        {existingReview !== null && (
                            <RipplePressable
                                style={[
                                    styles.deleteButton,
                                    { borderColor: theme.error, backgroundColor: `${theme.error}12` },
                                    isSubmitting && styles.submitButtonDisabled,
                                ]}
                                onPress={() => setDeleteConfirmVisible(true)}
                                disabled={isSubmitting}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.deleteButtonText, { color: theme.error }]}>Delete Review</Text>
                            </RipplePressable>
                        )}
                    </>
                )}
            </ScrollView>

            <ConfirmDialog
                visible={confirmVisible}
                title={submitConfirmTitle}
                message={submitConfirmMessage}
                confirmLabel={isEditing ? 'Update' : 'Submit'}
                cancelLabel="Cancel"
                variant="info"
                onConfirm={submitReview}
                onCancel={() => setConfirmVisible(false)}
            />

            <ConfirmDialog
                visible={deleteConfirmVisible}
                title="Delete Review"
                message="Are you sure you want to delete this review? This action cannot be undone."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={handleDeleteReview}
                onCancel={() => setDeleteConfirmVisible(false)}
            />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backButton: {
        marginRight: 16,
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    productBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
    },
    productImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 16,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    productSubtitle: {
        fontSize: 13,
    },
    formSection: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    inputContainer: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        minHeight: 120,
    },
    input: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
    },
    charCount: {
        textAlign: 'right',
        fontSize: 12,
        marginTop: 8,
    },
    submitButton: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 40,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    deleteButton: {
        marginTop: -24,
        marginBottom: 40,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
});
