import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ReviewImageUploader } from '../../components/review-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ImageWithFallback } from '../../components/ui/image-with-fallback';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { supabase } from '../../supabase/supabaseClient';
import { lightPalette } from '../../utils/theme';

export default function ReviewFormScreen() {
    const router = useRouter();
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
            Alert.alert('Required', 'Please select a star rating.');
            return;
        }
        if (reviewText.trim().length === 0) {
            Alert.alert('Required', 'Please write a review text.');
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

            Alert.alert('Success', 'Your review has been submitted successfully.', [
                { text: 'OK', onPress: () => router.back() }
            ]);

        } catch (error) {
            console.error('Submit review error:', error);
            Alert.alert('Error', 'Could not submit your review. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeScreen>
                <View style={styles.center}>
                    <LoadingIndicator message="Loading..." />
                </View>
            </SafeScreen>
        );
    }

    return (
        <SafeScreen>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={lightPalette.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{review_id ? 'Edit Review' : 'Write a Review'}</Text>
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.productBanner}>
                    <ImageWithFallback src={productImage} style={styles.productImage} />
                    <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
                        <Text style={styles.productSubtitle}>Rate your purchase</Text>
                    </View>
                </View>

                {/* Rating Input and Star Visuals */}
                <View style={styles.formSection}>
                    <Text style={styles.label}>Your Rating</Text>
                    <View style={styles.starsContainer}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}>
                                <Ionicons
                                    name={star <= rating ? 'star' : 'star-outline'}
                                    size={40}
                                    color={star <= rating ? '#FFCC00' : '#E9ECEF'}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>Your Review</Text>
                    <View style={styles.inputContainer}>
                        <React.Fragment>
                            {/* We use standard TextInput, manually bound for flexibility in screen layer without complex wrappers */}
                            <TextInput
                                style={styles.input}
                                value={reviewText}
                                onChangeText={setReviewText}
                                placeholder="What did you like or dislike?"
                                placeholderTextColor="#ADB5BD"
                                multiline
                                numberOfLines={5}
                                maxLength={500}
                                textAlignVertical="top"
                            />
                        </React.Fragment>
                    </View>
                    <Text style={styles.charCount}>{reviewText.length}/500</Text>
                </View>

                {/* Image Uploader */}
                <ReviewImageUploader
                    images={images}
                    onAddImage={handleAddImage}
                    onRemoveImage={handleRemoveImage}
                    maxImages={3}
                />

                <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={handleSubmitPress}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                >
                    {isSubmitting ? (
                        <LoadingIndicator message="" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Review</Text>
                    )}
                </TouchableOpacity>
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
        backgroundColor: '#F8F9FA',
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E9ECEF',
    },
    backButton: {
        marginRight: 16,
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    productBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E9ECEF',
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
        color: lightPalette.textPrimary,
        marginBottom: 4,
    },
    productSubtitle: {
        fontSize: 13,
        color: lightPalette.textSecondary,
    },
    formSection: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
        marginBottom: 8,
    },
    starsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    inputContainer: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E9ECEF',
        borderRadius: 12,
        padding: 12,
        minHeight: 120,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: lightPalette.textPrimary,
        lineHeight: 22,
    },
    charCount: {
        textAlign: 'right',
        fontSize: 12,
        color: lightPalette.textSecondary,
        marginTop: 8,
    },
    submitButton: {
        backgroundColor: lightPalette.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 40,
    },
    submitButtonDisabled: {
        backgroundColor: '#ADB5BD',
        opacity: 0.8,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
