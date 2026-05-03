import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ReviewImageUploader } from '../../components/review-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ImageWithFallback } from '../../components/ui/image-with-fallback';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { supabase } from '../../supabase/supabaseClient';

export default function ReviewFormScreen(): React.JSX.Element {
    const router = useRouter();
    const { theme } = useTheme();
    const { product_id, review_id } = useLocalSearchParams();

    const [loading, setLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [confirmVisible, setConfirmVisible] = useState<boolean>(false);

    // Product mock details
    const [productName, setProductName] = useState<string>('Loading product...');
    const [productImage, setProductImage] = useState<string>('');

    // Form state
    const [rating, setRating] = useState<number>(0);
    const [reviewText, setReviewText] = useState<string>('');
    const [images, setImages] = useState<string[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // In reality, fetch product details
                // const { data: product } = await productsTable.getById(Number(product_id));
                // MOCK
                await new Promise((resolve) => setTimeout(resolve, 500));
                setProductName('Vintage Denim Jacket');
                setProductImage('https://picsum.photos/200');

                // If review_id is passed, we are editing an existing review. Fetch it.
                if (review_id) {
                    // MOCK
                    setRating(4);
                    setReviewText('Great jacket, fits well but slightly darker than the picture.');
                    setImages(['https://picsum.photos/201']);
                }
            } catch (error) {
                console.error("Failed to load review details:", error);
            } finally {
                setLoading(false);
            }
        };

        void loadInitialData();
    }, [product_id, review_id]);

    const handleAddImage = (uri: string) => {
        setImages((prev) => [...prev, uri]);
    };

    const handleRemoveImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmitPress = () => {
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

    const submitReview = async () => {
        setConfirmVisible(false);
        setIsSubmitting(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.replace('/auth/login');
                return;
            }

            // MOCK submit process
            // 1. Upload images to storage bucket if needed
            // 2. Insert into `ratings` (or `reviews`) table
            await new Promise((resolve) => setTimeout(resolve, 1500));

            AppAlert.alert('Success', 'Your review has been submitted successfully.', [
                { text: 'OK', onPress: () => router.back() }
            ]);

        } catch (error) {
            console.error('Submit review error:', error);
            AppAlert.alert('Error', 'Could not submit your review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeScreen>
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <RipplePressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </RipplePressable>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{review_id ? 'Edit Review' : 'Write a Review'}</Text>
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
                                <Text style={[styles.submitButtonText, { color: theme.white }]}>Submit Review</Text>
                            )}
                        </RipplePressable>
                    </>
                )}
            </ScrollView>

            <ConfirmDialog
                visible={confirmVisible}
                title="Submit Review"
                message="Are you sure you want to submit this review? It will be publicly visible."
                confirmLabel="Submit"
                cancelLabel="Cancel"
                variant="info"
                onConfirm={submitReview}
                onCancel={() => setConfirmVisible(false)}
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
});
