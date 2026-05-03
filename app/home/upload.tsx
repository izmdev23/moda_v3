import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, InteractionManager, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { FormInput } from '../../components/ui/form-input';
import { DropdownOption, InlineDropdown } from '../../components/ui/inline-dropdown';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { ImageDetail, ImageUploader, RichTextInput, SavedExtractedImageOption, TagsInput, VariantData, VariantFieldGroup } from '../../components/upload-components';
import { TablesInsert } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { vtonUserPhotosBucket } from '../../utils/database/vton-results-bucket';
import { ProductCategory } from '../../utils/types';
import {
    isAccessoryCategory,
    normalizeExtractionResultUrl,
    parseVariantPayloads,
    type ParsedVariantPayload,
} from '../../utils/upload-product-utils';

const PRODUCT_CATEGORY_ENUM_VALUES: readonly ProductCategory[] = [
    'headwear',
    'upperwear',
    'lowerwear',
    'footwear',
    'accessory',
];

const CATEGORY_LABEL_SANITIZE_REGEX = /[^a-zA-Z0-9]+/g;
const CATEGORY_LABEL_WORD_SEPARATOR = ' ';
const CATEGORY_PLACEHOLDER = 'Select category';
const PRODUCT_IMAGES_BUCKET = 'product-images';
const VTON_USER_PHOTOS_BUCKET = 'vton-user-photos';
const OUTFIT_RESULTS_BUCKET = 'outfit-results';
const MAX_UPLOAD_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_EXTENSION_MAP: Readonly<Record<string, string>> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};
const EXTRACTION_POLL_INTERVAL_MS = 2500;
const EXTRACTION_MAX_POLL_ATTEMPTS = 60;
const EXTRACTION_SOURCE_UPLOAD_TIMEOUT_MS = 30000;
const EXTRACTION_FUNCTION_START_TIMEOUT_MS = 20000;
const EXTRACTION_FUNCTION_CHECK_TIMEOUT_MS = 20000;
const SAVED_EXTRACTED_LIST_LIMIT = 100;
const UPLOAD_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

interface UploadedImageResult {
    readonly path: string;
    readonly publicUrl: string;
}

interface ExtractOutfitStartResponse {
    readonly predictionId?: string;
    readonly status?: string;
    readonly error?: string;
}

interface ExtractOutfitCheckResponse {
    readonly status: 'starting' | 'processing' | 'succeeded' | 'failed';
    readonly resultUrl?: string | readonly string[] | { readonly url?: string; readonly href?: string };
    readonly storagePath?: string;
    readonly error?: string;
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

function resolveUploadExtension(image: ImageDetail): string {
    const mimeType = normalizeUploadMimeType(image);
    return IMAGE_EXTENSION_MAP[mimeType] ?? 'jpg';
}

function delay(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, timeoutMs);

        operation
            .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch((error: unknown) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

async function resolveInvokeErrorMessage(
    error: { readonly message?: string; readonly context?: Response },
    fallbackMessage: string,
): Promise<string> {
    const context = error.context;
    if (context === undefined) {
        console.error('[upload-product] extract-outfit invoke error (no response context):', {
            message: error.message ?? fallbackMessage,
        });
        return error.message ?? fallbackMessage;
    }

    const responseText = await context.text();
    console.error('[upload-product] extract-outfit invoke error response:', {
        status: context.status,
        body: responseText,
    });

    if (responseText.trim().length === 0) {
        return error.message ?? fallbackMessage;
    }

    try {
        const parsedBody = JSON.parse(responseText) as { readonly error?: unknown };
        if (typeof parsedBody.error === 'string' && parsedBody.error.trim().length > 0) {
            return parsedBody.error;
        }
    } catch {
        // Ignore parsing errors and fallback to raw response text.
    }

    return responseText;
}

async function removeStorageObjectIfExists(bucketName: string, storagePath: string | null): Promise<void> {
    if (storagePath === null || storagePath.trim().length === 0) {
        return;
    }

    const { error } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);

    if (error !== null) {
        console.warn('[upload-product] Failed to remove stale storage object:', {
            bucketName,
            storagePath,
            message: error.message,
        });
    }
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
    const [selectedCategory, setSelectedCategory] = useState<ProductCategory | ''>('');
    const [variants, setVariants] = useState<VariantData[]>([
        {
            id: '1',
            name: '',
            price: '',
            stock: '',
            sale_price: '',
            sale_end_date: undefined,
            is_full_body: false,
            try_on_image: null,
            try_on_image_url: null,
            try_on_image_storage_path: null,
            extracted_outfit_url: null,
            extracted_outfit_storage_path: null,
            extraction_error: null,
            is_extracting: false,
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isRichEditorReady, setIsRichEditorReady] = useState<boolean>(false);
    const [savedExtractedImages, setSavedExtractedImages] = useState<SavedExtractedImageOption[]>([]);
    const [isSavedExtractedLoading, setIsSavedExtractedLoading] = useState<boolean>(false);
    const [cachedDatabaseUserId, setCachedDatabaseUserId] = useState<number | null>(null);

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

    const hasExtractingVariants = variants.some((variant) => variant.is_extracting);

    const resolveCurrentDatabaseUserId = useCallback(async (): Promise<number> => {
        if (cachedDatabaseUserId !== null) {
            return cachedDatabaseUserId;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError !== null) {
            throw new Error(sessionError.message);
        }

        const authUserId = sessionData.session?.user?.id;
        if (authUserId === undefined) {
            throw new Error('You must be logged in to load saved extracted images.');
        }

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', authUserId)
            .single();

        if (userError !== null || userData === null) {
            throw new Error(userError?.message ?? 'Unable to load your account.');
        }

        setCachedDatabaseUserId(userData.id);

        return userData.id;
    }, [cachedDatabaseUserId]);

    const loadSavedExtractedImages = useCallback(async (): Promise<void> => {
        setIsSavedExtractedLoading(true);

        try {
            const databaseUserId = await resolveCurrentDatabaseUserId();

            const { data: filesData, error: listError } = await supabase.storage
                .from(OUTFIT_RESULTS_BUCKET)
                .list(String(databaseUserId), {
                    limit: SAVED_EXTRACTED_LIST_LIMIT,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' },
                });

            if (listError !== null) {
                throw new Error(listError.message);
            }

            const nextSavedImages: SavedExtractedImageOption[] = [];

            for (const file of filesData ?? []) {
                const normalizedName = file.name.trim();
                if (normalizedName.length === 0) {
                    continue;
                }

                const storagePath = `${databaseUserId}/${normalizedName}`;
                const { data: publicUrlData } = supabase.storage
                    .from(OUTFIT_RESULTS_BUCKET)
                    .getPublicUrl(storagePath);

                const label = typeof file.created_at === 'string' && file.created_at.trim().length > 0
                    ? new Date(file.created_at).toLocaleString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                    })
                    : normalizedName;

                nextSavedImages.push({
                    publicUrl: publicUrlData.publicUrl,
                    storagePath,
                    label,
                });
            }

            setSavedExtractedImages(nextSavedImages);
        } catch (savedImagesError: unknown) {
            console.warn('[upload-product] Failed to load saved extracted images:', savedImagesError);
            setSavedExtractedImages([]);
        } finally {
            setIsSavedExtractedLoading(false);
        }
    }, [resolveCurrentDatabaseUserId]);

    useEffect(() => {
        void loadSavedExtractedImages();
    }, [loadSavedExtractedImages]);

    const handleSelectSavedExtractedImage = useCallback((variantId: string, selectedImage: SavedExtractedImageOption): void => {
        setVariants((previousVariants) => previousVariants.map((variant) => {
            if (variant.id !== variantId) {
                return variant;
            }

            return {
                ...variant,
                try_on_image: null,
                try_on_image_url: selectedImage.publicUrl,
                try_on_image_storage_path: null,
                extracted_outfit_url: selectedImage.publicUrl,
                extracted_outfit_storage_path: selectedImage.storagePath,
                extraction_error: null,
                is_extracting: false,
            };
        }));
    }, []);

    const handleSelectTryOnImage = useCallback(async (variantId: string, image: ImageDetail): Promise<void> => {
        if (selectedCategory === '' || isAccessoryCategory(selectedCategory)) {
            throw new Error('Virtual try-on image selection is disabled for accessories.');
        }

        const previousVariant = variants.find((variant) => variant.id === variantId) ?? null;
        const previousTryOnImageUrl = previousVariant?.try_on_image_url ?? null;
        const previousTryOnStoragePath = previousVariant?.try_on_image_storage_path ?? null;
        const previousExtractedOutfitUrl = previousVariant?.extracted_outfit_url ?? null;
        const previousExtractedOutfitStoragePath = previousVariant?.extracted_outfit_storage_path ?? null;
        const variantIsFullBody = previousVariant?.is_full_body === true;
        let currentTryOnUploadPath: string | null = null;

        setVariants((previousVariants) => previousVariants.map((variant) => {
            if (variant.id !== variantId) {
                return variant;
            }

            return {
                ...variant,
                try_on_image: image,
                extraction_error: null,
                is_extracting: true,
            };
        }));

        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                throw new Error(sessionError.message);
            }

            const authUserId = sessionData.session?.user?.id;
            if (!authUserId) {
                throw new Error('You must be logged in to extract outfit images.');
            }

            const tryOnUploadPath = `${authUserId}/${Date.now()}-${variantId}.${resolveUploadExtension(image)}`;
            currentTryOnUploadPath = tryOnUploadPath;
            const sourceUpload = await withTimeout(
                vtonUserPhotosBucket.upload(tryOnUploadPath, image.uri, normalizeUploadMimeType(image)),
                EXTRACTION_SOURCE_UPLOAD_TIMEOUT_MS,
                'Uploading source image took too long. Please try a different image or retry.',
            );

            const { data: startData, error: startError } = await withTimeout(
                supabase.functions.invoke('extract-outfit', {
                    body: {
                        action: 'start',
                        sourceImageUrl: sourceUpload.publicUrl,
                        productCategory: selectedCategory,
                        isFullBody: variantIsFullBody,
                    },
                }),
                EXTRACTION_FUNCTION_START_TIMEOUT_MS,
                'Starting extraction took too long. Please retry.',
            );

            if (startError !== null) {
                const message = await resolveInvokeErrorMessage(
                    startError as { readonly message?: string; readonly context?: Response },
                    'Failed to start extraction.',
                );
                throw new Error(message);
            }

            const startPayload = startData as ExtractOutfitStartResponse;
            if (startPayload.error) {
                throw new Error(startPayload.error);
            }

            if (!startPayload.predictionId) {
                throw new Error('Extraction service did not return a prediction ID.');
            }

            let extractedOutfitUrl = '';
            let extractedStoragePath: string | null = null;

            for (let attempt = 0; attempt < EXTRACTION_MAX_POLL_ATTEMPTS; attempt += 1) {
                await delay(EXTRACTION_POLL_INTERVAL_MS);

                const { data: checkData, error: checkError } = await withTimeout(
                    supabase.functions.invoke('extract-outfit', {
                        body: {
                            action: 'check',
                            predictionId: startPayload.predictionId,
                        },
                    }),
                    EXTRACTION_FUNCTION_CHECK_TIMEOUT_MS,
                    'Checking extraction status timed out. Please retry.',
                );

                if (checkError !== null) {
                    const message = await resolveInvokeErrorMessage(
                        checkError as { readonly message?: string; readonly context?: Response },
                        'Failed to poll extraction status.',
                    );
                    throw new Error(message);
                }

                const checkPayload = checkData as ExtractOutfitCheckResponse;
                if (!checkPayload.status) {
                    throw new Error('Extraction status response was invalid. Please retry.');
                }

                if (checkPayload.status === 'failed') {
                    throw new Error(checkPayload.error ?? 'Outfit extraction failed.');
                }

                if (checkPayload.status === 'succeeded') {
                    extractedOutfitUrl = normalizeExtractionResultUrl(checkPayload.resultUrl);
                    extractedStoragePath = typeof checkPayload.storagePath === 'string'
                        ? checkPayload.storagePath
                        : null;
                    break;
                }
            }

            if (extractedOutfitUrl.length === 0) {
                throw new Error('Outfit extraction timed out. Please try again.');
            }

            setVariants((previousVariants) => previousVariants.map((variant) => {
                if (variant.id !== variantId) {
                    return variant;
                }

                return {
                    ...variant,
                    try_on_image: image,
                    try_on_image_url: sourceUpload.publicUrl,
                    try_on_image_storage_path: tryOnUploadPath,
                    extracted_outfit_url: extractedOutfitUrl,
                    extracted_outfit_storage_path: extractedStoragePath,
                    extraction_error: null,
                    is_extracting: false,
                };
            }));

            if (previousTryOnStoragePath !== null && previousTryOnStoragePath !== tryOnUploadPath) {
                await removeStorageObjectIfExists(VTON_USER_PHOTOS_BUCKET, previousTryOnStoragePath);
            }

            await loadSavedExtractedImages();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to extract outfit image.';
            console.error('[upload-product] Outfit extraction failed:', {
                variantId,
                selectedCategory,
                message,
                error,
            });

            if (currentTryOnUploadPath !== null && currentTryOnUploadPath !== previousTryOnStoragePath) {
                await removeStorageObjectIfExists(VTON_USER_PHOTOS_BUCKET, currentTryOnUploadPath);
            }

            setVariants((previousVariants) => previousVariants.map((variant) => {
                if (variant.id !== variantId) {
                    return variant;
                }

                return {
                    ...variant,
                    try_on_image: image,
                    try_on_image_url: previousTryOnImageUrl,
                    try_on_image_storage_path: previousTryOnStoragePath,
                    extracted_outfit_url: previousExtractedOutfitUrl,
                    extracted_outfit_storage_path: previousExtractedOutfitStoragePath,
                    extraction_error: message,
                    is_extracting: false,
                };
            }));

            throw new Error(message);
        }
    }, [loadSavedExtractedImages, selectedCategory, variants]);

    const onSubmit = async (formData: UploadProductFormValues): Promise<void> => {
        if (!description) {
            AppAlert.alert('Error', 'Description is required.');
            return;
        }
        if (variants.length === 0) {
            AppAlert.alert('Error', 'At least one variant is required.');
            return;
        }
        if (variants.some(v => !v.name || !v.price || !v.stock)) {
            AppAlert.alert('Error', 'All variant fields must be filled.');
            return;
        }
        if (hasExtractingVariants) {
            AppAlert.alert('Error', 'Please wait for all outfit extraction tasks to finish before publishing.');
            return;
        }
        if (formData.category === '') {
            AppAlert.alert('Error', 'Category is required.');
            return;
        }
        if (isAccessoryCategory(formData.category) && thumbnail.length === 0) {
            AppAlert.alert('Error', 'Accessories require a manual thumbnail image.');
            return;
        }

        const normalizedName = formData.name.trim();
        const normalizedDescription = description.trim();
        if (normalizedName.length === 0) {
            AppAlert.alert('Error', 'Product name is required.');
            return;
        }
        if (normalizedDescription.length === 0) {
            AppAlert.alert('Error', 'Description is required.');
            return;
        }

        let parsedVariants: ParsedVariantPayload[] = [];
        try {
            parsedVariants = parseVariantPayloads(variants, formData.category);
        } catch (variantParseError: unknown) {
            const variantErrorMessage = variantParseError instanceof Error
                ? variantParseError.message
                : 'One or more variants are invalid.';
            AppAlert.alert('Error', variantErrorMessage);
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
            let resolvedThumbnailUrl = '';

            if (isAccessoryCategory(formData.category)) {
                const thumbnailUpload = await uploadProductImage(
                    thumbnail[0],
                    userData.id,
                    productUploadKey,
                    'thumbnail',
                    0,
                );
                uploadedPaths.push(thumbnailUpload.path);
                resolvedThumbnailUrl = thumbnailUpload.publicUrl;
            } else {
                const extractedVariant = parsedVariants.find((variant) => variant.extractedOutfitUrl !== null);
                if (!extractedVariant || extractedVariant.extractedOutfitUrl === null) {
                    throw new Error('At least one extracted outfit image is required for non-accessory products.');
                }
                resolvedThumbnailUrl = extractedVariant.extractedOutfitUrl;
            }

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
                thumbnail_url: resolvedThumbnailUrl,
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
                    is_full_body: variant.isFullBody,
                    try_on_image_url: variant.tryOnImageUrl,
                    extracted_outfit_url: variant.extractedOutfitUrl,
                };
            });

            const { error: variantInsertError } = await supabase
                .from('product_variants')
                .insert(variantRows);

            if (variantInsertError) {
                throw new Error(variantInsertError.message);
            }

            AppAlert.alert('Success', 'Product published successfully!', [
                { text: 'OK', onPress: () => router.push('/home/seller-dashboard') }
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

            AppAlert.alert('Error', message);
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
            AppAlert.alert('No Thumbnail', 'Please add a thumbnail image first.');
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
                AppAlert.alert('Done!', 'Description generated. You can edit it before publishing.');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate description';
            AppAlert.alert('Generation Failed', msg);
        } finally {
            setIsGenerating(false);
        }
    }, [thumbnail]);

    return (
        <SafeScreen style={[styles.screen, { backgroundColor: theme.background }]} edges={UPLOAD_SAFE_AREA_EDGES}>
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
                                onSelect={(nextCategoryValue) => {
                                    onChange(nextCategoryValue);
                                    setSelectedCategory(nextCategoryValue);

                                    if (nextCategoryValue === 'accessory') {
                                        setVariants((previousVariants) => previousVariants.map((variant) => {
                                            return {
                                                ...variant,
                                                is_full_body: false,
                                                try_on_image: null,
                                                try_on_image_url: null,
                                                try_on_image_storage_path: null,
                                                extracted_outfit_url: null,
                                                extracted_outfit_storage_path: null,
                                                extraction_error: null,
                                                is_extracting: false,
                                            };
                                        }));
                                    }
                                }}
                                placeholder={CATEGORY_PLACEHOLDER}
                                error={errors.category?.message as string | undefined}
                            />
                        );
                    }}
                />

                {selectedCategory === 'accessory' ? (
                    <ImageUploader
                        label="Thumbnail (Max 1)"
                        images={thumbnail}
                        maxCount={1}
                        onAdd={(img) => setThumbnail([img])}
                        onRemove={() => setThumbnail([])}
                    />
                ) : (
                    <View style={[styles.thumbnailInfoContainer, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.thumbnailInfoText, { color: theme.textSecondary }]}>
                            {selectedCategory === ''
                                ? 'Select a category to configure thumbnail behavior. Accessories require manual thumbnail upload.'
                                : 'Non-accessory products use extracted outfit images as the product thumbnail automatically.'}
                        </Text>
                    </View>
                )}

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
                    isAccessoryCategory={selectedCategory === 'accessory'}
                    onSelectTryOnImage={handleSelectTryOnImage}
                    savedExtractedImages={savedExtractedImages}
                    isSavedExtractedLoading={isSavedExtractedLoading}
                    onRefreshSavedExtractedImages={loadSavedExtractedImages}
                    onSelectSavedExtractedImage={handleSelectSavedExtractedImage}
                />

                <RipplePressable
                    style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: (isLoading || hasExtractingVariants) ? 0.7 : 1 }]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isLoading || hasExtractingVariants}
                >
                    <Text style={styles.submitBtnText}>{isLoading ? 'Publishing...' : hasExtractingVariants ? 'Waiting for extraction...' : 'Publish Product'}</Text>
                </RipplePressable>
                    <View style={{ height: 40 }} />
                </View>
            </ScrollView>

            {isLoading && <LoadingIndicator overlay={true} message="Publishing product..." />}
        </SafeScreen>
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
    thumbnailInfoContainer: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 20,
    },
    thumbnailInfoText: {
        fontSize: 13,
        lineHeight: 18,
    },
});
