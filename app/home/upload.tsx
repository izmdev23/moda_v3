import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, InteractionManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FormInput } from '../../components/ui/form-input';
import { DropdownOption, InlineDropdown } from '../../components/ui/inline-dropdown';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { useTheme } from '../../components/ui/theme-provider';
import { ImageDetail, ImageUploader, RichTextInput, TagsInput, VariantData, VariantFieldGroup } from '../../components/upload-components';
import { TablesInsert } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { ProductCategory } from '../../utils/types';

const PRODUCT_CATEGORY_ENUM_VALUES: readonly ProductCategory[] = [
    'headwear',
    'tops',
    'bottoms',
    'footwear',
    'full_body',
    'accessory',
];

const CATEGORY_LABEL_SANITIZE_REGEX = /[^a-zA-Z0-9]+/g;
const CATEGORY_LABEL_WORD_SEPARATOR = ' ';
const CATEGORY_PLACEHOLDER = 'Select category';
const PRODUCT_IMAGES_BUCKET = 'product-images';
const MAX_UPLOAD_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_EXTENSION_MAP: Readonly<Record<string, string>> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

interface UploadedImageResult {
    readonly path: string;
    readonly publicUrl: string;
}

interface ParsedVariantPayload {
    readonly name: string;
    readonly price: number;
    readonly stock: number;
    readonly salePrice: number | null;
    readonly saleEndDate: string | null;
}

function inferMimeTypeFromUri(fileUri: string): string {
    const loweredUri = fileUri.toLowerCase();
    if (loweredUri.endsWith('.png')) {
        return 'image/png';
    }
    if (loweredUri.endsWith('.webp')) {
        return 'image/webp';
    }
    return 'image/jpeg';
}

function normalizeUploadMimeType(image: ImageDetail): string {
    const rawMimeType = (image.type ?? '').toLowerCase();
    if (rawMimeType === 'image/jpg') {
        return 'image/jpeg';
    }
    if (rawMimeType.length === 0) {
        return inferMimeTypeFromUri(image.uri);
    }
    return rawMimeType;
}

function readLocalUriAsBlob(fileUri: string): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.onerror = () => {
            reject(new Error('Unable to read one of the selected images. Please choose another image and try again.'));
        };

        xhr.onload = () => {
            const response = xhr.response;
            if (response instanceof Blob) {
                resolve(response);
                return;
            }
            reject(new Error('Unable to process one of the selected images.'));
        };

        xhr.responseType = 'blob';
        xhr.open('GET', fileUri, true);
        xhr.send();
    });
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as ArrayBuffer);
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('Failed to process one of the selected images for upload.'));
        };
        reader.readAsArrayBuffer(blob);
    });
}

function parsePositiveNumber(rawValue: string, fieldLabel: string): number {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        throw new Error(`${fieldLabel} must be greater than 0.`);
    }
    return parsedValue;
}

function parseNonNegativeInteger(rawValue: string, fieldLabel: string): number {
    const parsedValue = Number(rawValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        throw new Error(`${fieldLabel} must be a valid whole number.`);
    }
    return parsedValue;
}

function parseOptionalSalePrice(rawValue: string): number | null {
    const trimmedValue = rawValue.trim();
    if (trimmedValue.length === 0) {
        return null;
    }

    return parsePositiveNumber(trimmedValue, 'Sale price');
}

function parseVariantPayloads(variants: readonly VariantData[]): ParsedVariantPayload[] {
    return variants.map((variant, index) => {
        const variantLabel = `Variant ${index + 1}`;
        const variantName = variant.name.trim();
        if (variantName.length === 0) {
            throw new Error(`${variantLabel} name is required.`);
        }

        return {
            name: variantName,
            price: parsePositiveNumber(variant.price, `${variantLabel} price`),
            stock: parseNonNegativeInteger(variant.stock, `${variantLabel} stock`),
            salePrice: parseOptionalSalePrice(variant.sale_price),
            saleEndDate: variant.sale_end_date ? variant.sale_end_date.toISOString() : null,
        };
    });
}

function buildProductUploadKey(userId: number): string {
    const timestamp = Date.now();
    const randomToken = Math.floor(Math.random() * 1000000).toString();
    return `${userId}-${timestamp}-${randomToken}`;
}

async function uploadProductImage(
    image: ImageDetail,
    userId: number,
    productUploadKey: string,
    imageLabel: 'thumbnail' | 'gallery',
    imageIndex: number,
): Promise<UploadedImageResult> {
    const normalizedMimeType = normalizeUploadMimeType(image);
    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(normalizedMimeType)) {
        throw new Error('Only JPG, PNG, and WEBP images are allowed.');
    }

    const blob = await readLocalUriAsBlob(image.uri);
    if (blob.size > MAX_UPLOAD_IMAGE_SIZE_BYTES) {
        throw new Error('Image size is too large. Maximum file size is 5 MB per image.');
    }

    const extension = IMAGE_EXTENSION_MAP[normalizedMimeType] ?? 'jpg';
    const filePath = `${userId}/${productUploadKey}/${imageLabel}-${imageIndex}.${extension}`;
    const arrayBuffer = await blobToArrayBuffer(blob);

    const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(filePath, arrayBuffer, {
            contentType: normalizedMimeType,
            upsert: true,
        });

    if (uploadError) {
        throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .getPublicUrl(filePath);

    return {
        path: filePath,
        publicUrl: publicUrlData.publicUrl,
    };
}

function formatCategoryLabel(rawCategory: ProductCategory): string {
    const cleanedCategory = rawCategory
        .replace(CATEGORY_LABEL_SANITIZE_REGEX, CATEGORY_LABEL_WORD_SEPARATOR)
        .trim();

    if (cleanedCategory.length === 0) {
        return '';
    }

    return cleanedCategory
        .split(CATEGORY_LABEL_WORD_SEPARATOR)
        .filter((word) => word.length > 0)
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
        .join(CATEGORY_LABEL_WORD_SEPARATOR);
}

const PRODUCT_CATEGORY_OPTIONS: readonly DropdownOption<ProductCategory>[] = PRODUCT_CATEGORY_ENUM_VALUES
    .map((categoryValue) => ({
        value: categoryValue,
        label: formatCategoryLabel(categoryValue),
    }));

interface UploadProductFormValues {
    readonly name: string;
    readonly category: ProductCategory | '';
}

export default function UploadProductScreen() {
    const { theme } = useTheme();
    const [images, setImages] = useState<ImageDetail[]>([]);
    const [thumbnail, setThumbnail] = useState<ImageDetail[]>([]);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [variants, setVariants] = useState<VariantData[]>([
        { id: '1', name: '', price: '', stock: '', sale_price: '', sale_end_date: undefined }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isRichEditorReady, setIsRichEditorReady] = useState<boolean>(false);

    const { control, handleSubmit, formState: { errors } } = useForm<UploadProductFormValues>({
        defaultValues: { name: '', category: '' }
    });

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setIsRichEditorReady(true);
        });

        return () => {
            task.cancel();
        };
    }, []);

    const onSubmit = async (formData: UploadProductFormValues): Promise<void> => {
        if (images.length === 0) {
            Alert.alert('Error', 'Please add at least one product image.');
            return;
        }
        if (thumbnail.length === 0) {
            Alert.alert('Error', 'Please add a thumbnail.');
            return;
        }
        if (!description) {
            Alert.alert('Error', 'Description is required.');
            return;
        }
        if (variants.some(v => !v.name || !v.price || !v.stock)) {
            Alert.alert('Error', 'All variant fields must be filled.');
            return;
        }
        if (formData.category === '') {
            Alert.alert('Error', 'Category is required.');
            return;
        }

        const normalizedName = formData.name.trim();
        const normalizedDescription = description.trim();
        if (normalizedName.length === 0) {
            Alert.alert('Error', 'Product name is required.');
            return;
        }
        if (normalizedDescription.length === 0) {
            Alert.alert('Error', 'Description is required.');
            return;
        }

        let parsedVariants: ParsedVariantPayload[] = [];
        try {
            parsedVariants = parseVariantPayloads(variants);
        } catch (variantParseError: unknown) {
            const variantErrorMessage = variantParseError instanceof Error
                ? variantParseError.message
                : 'One or more variants are invalid.';
            Alert.alert('Error', variantErrorMessage);
            return;
        }

        const normalizedTags: string[] = tags
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);

        const uploadedPaths: string[] = [];
        let createdProductId: number | null = null;

        try {
            setIsLoading(true);
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                throw new Error(sessionError.message);
            }

            const authUserId = sessionData.session?.user?.id;
            if (!authUserId) {
                throw new Error('You must be logged in to publish a product.');
            }

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, role')
                .eq('auth_id', authUserId)
                .single();

            if (userError || !userData) {
                throw new Error('Failed to load your seller account.');
            }

            if (userData.role !== 'seller') {
                throw new Error('Only seller accounts can upload products.');
            }

            const { data: shopData, error: shopError } = await supabase
                .from('shops')
                .select('id, shop_name')
                .eq('user_id', userData.id)
                .single();

            if (shopError || !shopData) {
                throw new Error('No shop was found for this seller account.');
            }

            const productUploadKey = buildProductUploadKey(userData.id);

            const thumbnailUpload = await uploadProductImage(
                thumbnail[0],
                userData.id,
                productUploadKey,
                'thumbnail',
                0,
            );
            uploadedPaths.push(thumbnailUpload.path);

            const galleryUploads: UploadedImageResult[] = [];
            for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
                const imageToUpload = images[imageIndex];
                if (!imageToUpload) {
                    continue;
                }

                const uploadedImage = await uploadProductImage(
                    imageToUpload,
                    userData.id,
                    productUploadKey,
                    'gallery',
                    imageIndex,
                );

                uploadedPaths.push(uploadedImage.path);
                galleryUploads.push(uploadedImage);
            }

            const productInsertPayload: TablesInsert<'products'> = {
                name: normalizedName,
                category: formData.category,
                description: normalizedDescription,
                thumbnail_url: thumbnailUpload.publicUrl,
                shop_id: shopData.id,
                shop_name: shopData.shop_name,
                tags: normalizedTags,
            };

            const { data: createdProduct, error: productInsertError } = await supabase
                .from('products')
                .insert(productInsertPayload)
                .select('id, uid')
                .single();

            if (productInsertError || !createdProduct) {
                throw new Error(productInsertError?.message ?? 'Failed to create product.');
            }

            createdProductId = createdProduct.id;

            if (galleryUploads.length > 0) {
                const imageRows: TablesInsert<'product_images'>[] = galleryUploads.map((upload, index) => {
                    return {
                        product_id: createdProduct.id,
                        image_url: upload.publicUrl,
                        sort_order: index,
                    };
                });

                const { error: imageInsertError } = await supabase
                    .from('product_images')
                    .insert(imageRows);

                if (imageInsertError) {
                    throw new Error(imageInsertError.message);
                }
            }

            const variantRows: TablesInsert<'product_variants'>[] = parsedVariants.map((variant) => {
                return {
                    product_id: createdProduct.id,
                    name: variant.name,
                    price: variant.price,
                    stock: variant.stock,
                    sale_price: variant.salePrice,
                    sale_end_date: variant.saleEndDate,
                };
            });

            const { error: variantInsertError } = await supabase
                .from('product_variants')
                .insert(variantRows);

            if (variantInsertError) {
                throw new Error(variantInsertError.message);
            }

            Alert.alert('Success', 'Product published successfully!', [
                { text: 'OK', onPress: () => router.replace('/home/seller-dashboard') }
            ]);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to publish product.';

            try {
                if (createdProductId !== null) {
                    await supabase.from('product_variants').delete().eq('product_id', createdProductId);
                    await supabase.from('product_images').delete().eq('product_id', createdProductId);
                    await supabase.from('products').delete().eq('id', createdProductId);
                }

                if (uploadedPaths.length > 0) {
                    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(uploadedPaths);
                }
            } catch (cleanupError: unknown) {
                console.warn('[upload-product] Rollback cleanup failed:', cleanupError);
            }

            Alert.alert('Error', message);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Calls the `describe-image` edge function with the thumbnail image to
     * auto-generate a product description using Gemini 2.5 Flash.
     * Converts the local thumbnail URI to base64 before sending.
     */
    const handleAutoGenerate = useCallback(async (): Promise<void> => {
        if (thumbnail.length === 0) {
            Alert.alert('No Thumbnail', 'Please add a thumbnail image first.');
            return;
        }

        setIsGenerating(true);
        try {
            const { uri, type } = thumbnail[0];

            // Convert local URI to base64
            const response = await fetch(uri);
            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i] ?? 0);
            }
            const imageBase64 = btoa(binary);

            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token ?? '';

            const { data, error } = await supabase.functions.invoke('describe-image', {
                body: { imageBase64, mimeType: type },
                headers: { Authorization: `Bearer ${token}` },
            });

            if (error !== null) {
                throw new Error(error.message ?? 'Failed to generate description');
            }

            type DescribeResponse = { description?: string; error?: string };
            const res = data as DescribeResponse;

            if (res.error) {
                throw new Error(res.error);
            }

            if (res.description) {
                setDescription(res.description);
                Alert.alert('Done!', 'Description generated. You can edit it before publishing.');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate description';
            Alert.alert('Generation Failed', msg);
        } finally {
            setIsGenerating(false);
        }
    }, [thumbnail]);

    return (
        <View style={[styles.screen, { backgroundColor: theme.background }]}>
            <ScrollView style={styles.container}>
                <View style={styles.formContainer}>
                <Text style={[styles.headerText, { color: theme.textPrimary }]}>Upload New Product</Text>

                <FormInput
                    control={control}
                    name="name"
                    label="Product Name"
                    placeholder="e.g. Vintage Denim Jacket"
                    rules={{ required: 'Product name is required' }}
                    error={errors.name?.message as string}
                />

                <Controller
                    control={control}
                    name="category"
                    rules={{ required: 'Category is required' }}
                    render={({ field: { onChange, value } }) => {
                        return (
                            <InlineDropdown
                                label="Category"
                                value={value}
                                options={PRODUCT_CATEGORY_OPTIONS}
                                onSelect={onChange}
                                placeholder={CATEGORY_PLACEHOLDER}
                                error={errors.category?.message as string | undefined}
                            />
                        );
                    }}
                />

                <ImageUploader
                    label="Thumbnail (Max 1)"
                    images={thumbnail}
                    maxCount={1}
                    onAdd={(img) => setThumbnail([img])}
                    onRemove={() => setThumbnail([])}
                />

                <ImageUploader
                    label="Product Images (Max 3)"
                    images={images}
                    maxCount={3}
                    onAdd={(img) => setImages([...images, img])}
                    onRemove={(index) => setImages(images.filter((_, i) => i !== index))}
                />

                {isRichEditorReady ? (
                    <RichTextInput
                        label="Description"
                        value={description}
                        onChange={setDescription}
                        onAutoGenerate={handleAutoGenerate}
                        isGenerating={isGenerating}
                    />
                ) : (
                    <View style={[styles.editorLoadingContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                        <ActivityIndicator size="small" color={theme.primary} />
                        <Text style={[styles.editorLoadingText, { color: theme.textSecondary }]}>Loading editor...</Text>
                    </View>
                )}

                <TagsInput
                    label="Tags"
                    tags={tags}
                    onTagsChange={setTags}
                />

                <VariantFieldGroup
                    variants={variants}
                    onChange={setVariants}
                />

                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: isLoading ? 0.7 : 1 }]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isLoading}
                >
                    <Text style={styles.submitBtnText}>{isLoading ? 'Publishing...' : 'Publish Product'}</Text>
                </TouchableOpacity>
                    <View style={{ height: 40 }} />
                </View>
            </ScrollView>

            {isLoading && <LoadingIndicator overlay={true} message="Publishing product..." />}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    formContainer: {
        padding: 16,
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    submitBtn: {
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    editorLoadingContainer: {
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 120,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    editorLoadingText: {
        fontSize: 13,
    },
});
