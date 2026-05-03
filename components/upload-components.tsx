import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef } from 'react';
import { ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';
import { useTheme } from '../components/ui/theme-provider';

export interface ImageDetail {
    uri: string;
    type: string;
}

interface ImageUploaderProps {
    label: string;
    images: ImageDetail[];
    maxCount: number;
    onAdd: (img: ImageDetail) => void;
    onRemove: (index: number) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ label, images, maxCount, onAdd, onRemove }) => {
    const { theme } = useTheme();

    const handlePick = async () => {
        if (images.length >= maxCount) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: false,
            quality: 1,
        });

        if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0];
            if (!asset.uri.match(/\.(jpg|jpeg|png|webp)$/i)) {
                AppAlert.alert('Validation Error', 'Only JPG, PNG, and WEBP are allowed.');
                return;
            }
            onAdd({ uri: asset.uri, type: asset.mimeType || 'image/jpeg' });
        }
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>{label} ({images.length}/{maxCount})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScroll}>
                {images.map((img, index) => (
                    <View key={index} style={styles.imageContainer}>
                        <Image source={{ uri: img.uri }} style={styles.image} contentFit="cover" />
                        <RipplePressable style={styles.removeBtn} onPress={() => onRemove(index)}>
                            <MaterialIcons name="close" size={16} color="white" />
                        </RipplePressable>
                    </View>
                ))}
                {images.length < maxCount && (
                    <RipplePressable
                        style={[styles.addBtn, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                        onPress={handlePick}
                    >
                        <MaterialIcons name="add-photo-alternate" size={32} color={theme.textSecondary} />
                        <Text style={[styles.addBtnText, { color: theme.textSecondary }]}>Add</Text>
                    </RipplePressable>
                )}
            </ScrollView>
        </View>
    );
};

interface RichTextInputProps {
    label: string;
    value: string;
    onChange: (text: string) => void;
    /** Optional callback to trigger Gemini auto-generation. If provided, an "✨ Auto-generate" button is shown. */
    onAutoGenerate?: () => Promise<void>;
    /** When true, shows a loading indicator on the auto-generate button. */
    isGenerating?: boolean;
}

export const RichTextInput: React.FC<RichTextInputProps> = ({ label, value, onChange, onAutoGenerate, isGenerating }) => {
    const { theme } = useTheme();
    const editorRef = useRef<RichEditor>(null);

    React.useEffect(() => {
        if (editorRef.current && value) {
            // init
        }
    }, []);

    return (
        <View style={styles.container}>
            {/* Label row with optional Auto-generate button */}
            <View style={richStyles.labelRow}>
                <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0 }]}>{label}</Text>
                {onAutoGenerate !== undefined && (
                    <RipplePressable
                        style={[richStyles.autoGenBtn, { borderColor: theme.primary, opacity: isGenerating === true ? 0.6 : 1 }]}
                        onPress={() => void onAutoGenerate()}
                        disabled={isGenerating === true}
                    >
                        {isGenerating === true ? (
                            <ActivityIndicator size="small" color={theme.primary} />
                        ) : (
                            <Text style={[richStyles.autoGenBtnText, { color: theme.primary }]}>✨ Auto-generate</Text>
                        )}
                    </RipplePressable>
                )}
            </View>
            <View style={[styles.editorContainer, { borderColor: theme.border }]}>
                <RichToolbar
                    editor={editorRef}
                    actions={[
                        actions.setBold,
                        actions.setItalic,
                        actions.insertBulletsList,
                        actions.insertOrderedList,
                        actions.setUnderline,
                        actions.setStrikethrough
                    ]}
                    iconTint={theme.textSecondary}
                    selectedIconTint={theme.primary}
                    style={{ backgroundColor: theme.cardBackground }}
                />
                <RichEditor
                    ref={editorRef}
                    initialContentHTML={value}
                    onChange={onChange}
                    placeholder="Product description..."
                    editorStyle={{
                        backgroundColor: theme.background,
                        color: theme.textPrimary,
                        placeholderColor: theme.textSecondary,
                    }}
                    style={styles.editor}
                />
            </View>
        </View>
    );
};

interface TagsInputProps {
    label: string;
    tags: string[];
    onTagsChange: (tags: string[]) => void;
}

export const TagsInput: React.FC<TagsInputProps> = ({ label, tags, onTagsChange }) => {
    const { theme } = useTheme();
    const [input, setInput] = React.useState('');

    const handleAdd = () => {
        const newTags = input.split(',').map(t => t.trim()).filter(t => t.length > 0 && !tags.includes(t));
        if (newTags.length > 0) {
            onTagsChange([...tags, ...newTags]);
            setInput('');
        }
    };

    const removeTag = (index: number) => {
        onTagsChange(tags.filter((_, i) => i !== index));
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
            <View style={styles.tagsRow}>
                {tags.map((tag, i) => (
                    <View key={i} style={[styles.tagChip, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}>
                        <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
                        <RipplePressable onPress={() => removeTag(i)}>
                            <MaterialIcons name="close" size={16} color={theme.primary} />
                        </RipplePressable>
                    </View>
                ))}
            </View>
            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.cardBackground }]}
                value={input}
                onChangeText={setInput}
                onBlur={handleAdd}
                onSubmitEditing={handleAdd}
                placeholder="Add tags (comma separated)..."
                placeholderTextColor={theme.textSecondary}
                returnKeyType="done"
            />
        </View>
    );
};

export interface VariantData {
    id: string; // temp id
    name: string;
    price: string;
    stock: string;
    sale_price: string;
    sale_end_date: Date | undefined;
    is_full_body: boolean;
    try_on_image: ImageDetail | null;
    try_on_image_url: string | null;
    try_on_image_storage_path: string | null;
    extracted_outfit_url: string | null;
    extracted_outfit_storage_path: string | null;
    extraction_error: string | null;
    is_extracting: boolean;
}

export interface SavedExtractedImageOption {
    readonly publicUrl: string;
    readonly storagePath: string;
    readonly label: string;
}

interface VariantFieldGroupProps {
    readonly variants: VariantData[];
    readonly onChange: (variants: VariantData[]) => void;
    readonly isAccessoryCategory: boolean;
    readonly onSelectTryOnImage: (variantId: string, image: ImageDetail) => Promise<void>;
    readonly savedExtractedImages: readonly SavedExtractedImageOption[];
    readonly isSavedExtractedLoading: boolean;
    readonly onRefreshSavedExtractedImages: () => Promise<void>;
    readonly onSelectSavedExtractedImage: (variantId: string, image: SavedExtractedImageOption) => void;
}

export const VariantFieldGroup: React.FC<VariantFieldGroupProps> = ({
    variants,
    onChange,
    isAccessoryCategory,
    onSelectTryOnImage,
    savedExtractedImages,
    isSavedExtractedLoading,
    onRefreshSavedExtractedImages,
    onSelectSavedExtractedImage,
}) => {
    const { theme } = useTheme();
    const [actionVariantId, setActionVariantId] = React.useState<string | null>(null);
    const [savedPickerVariantId, setSavedPickerVariantId] = React.useState<string | null>(null);
    const [fullscreenImageUrl, setFullscreenImageUrl] = React.useState<string | null>(null);

    const handleUpdate = <K extends keyof VariantData>(id: string, field: K, value: VariantData[K]): void => {
        onChange(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    const handleRemove = (id: string) => {
        onChange(variants.filter(v => v.id !== id));
    };

    const handleAdd = () => {
        onChange([
            ...variants,
            {
                id: Math.random().toString(),
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
    };

    const pickSingleImage = async (): Promise<ImageDetail | null> => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: false,
            quality: 1,
        });

        if (result.canceled || result.assets.length === 0) {
            return null;
        }

        const asset = result.assets[0];
        if (!asset.uri.match(/\.(jpg|jpeg|png|webp)$/i)) {
            AppAlert.alert('Validation Error', 'Only JPG, PNG, and WEBP are allowed.');
            return null;
        }

        return {
            uri: asset.uri,
            type: asset.mimeType ?? 'image/jpeg',
        };
    };

    const handlePickTryOnImage = async (variantId: string): Promise<void> => {
        const selectedImage = await pickSingleImage();
        if (selectedImage === null) {
            return;
        }

        try {
            await onSelectTryOnImage(variantId, selectedImage);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to process selected image.';
            AppAlert.alert('Extraction Failed', message);
        }
    };

    const handlePressTryOnButton = async (variant: VariantData): Promise<void> => {
        if (variant.is_extracting || isAccessoryCategory) {
            return;
        }

        if (variant.extracted_outfit_url !== null) {
            setActionVariantId(variant.id);
            return;
        }

        await handlePickTryOnImage(variant.id);
    };

    const handleOpenDownload = async (): Promise<void> => {
        if (fullscreenImageUrl === null) {
            return;
        }

        const canOpen = await Linking.canOpenURL(fullscreenImageUrl);
        if (!canOpen) {
            AppAlert.alert('Download Unavailable', 'Could not open this image URL.');
            return;
        }

        await Linking.openURL(fullscreenImageUrl);
    };

    const activeVariant = actionVariantId === null
        ? null
        : variants.find((variant) => variant.id === actionVariantId) ?? null;

    const savedPickerVariant = savedPickerVariantId === null
        ? null
        : variants.find((variant) => variant.id === savedPickerVariantId) ?? null;

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>Variants ({variants.length})</Text>
            {variants.map((v, i) => (
                <View key={v.id} style={[styles.variantCard, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                    <View style={styles.variantHeader}>
                        <Text style={[styles.variantTitle, { color: theme.textPrimary }]}>Variant {i + 1}</Text>
                        {variants.length > 1 && (
                            <RipplePressable onPress={() => handleRemove(v.id)}>
                                <Text style={{ color: theme.error }}>Remove</Text>
                            </RipplePressable>
                        )}
                    </View>
                    <TextInput
                        style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, marginBottom: 8 }]}
                        placeholder="Name (e.g. Red, XL)"
                        placeholderTextColor={theme.textSecondary}
                        value={v.name}
                        onChangeText={(txt) => handleUpdate(v.id, 'name', txt)}
                    />
                    <RipplePressable
                        style={[styles.checkboxRow, { borderColor: theme.border, opacity: isAccessoryCategory ? 0.5 : 1 }]}
                        onPress={() => {
                            if (!isAccessoryCategory) {
                                handleUpdate(v.id, 'is_full_body', !v.is_full_body);
                            }
                        }}
                        disabled={isAccessoryCategory}
                    >
                        <MaterialIcons
                            name={v.is_full_body ? 'check-box' : 'check-box-outline-blank'}
                            size={20}
                            color={v.is_full_body ? theme.primary : theme.textSecondary}
                        />
                        <Text style={[styles.checkboxText, { color: theme.textPrimary }]}>Apply this variant as full body</Text>
                    </RipplePressable>

                    {isAccessoryCategory ? (
                        <Text style={[styles.helperText, { color: theme.textSecondary }]}>Virtual try-on and full body options are disabled for accessories.</Text>
                    ) : (
                        <>
                            <Text style={[styles.helperText, { color: theme.textSecondary }]}>Virtual Try-On Image (required)</Text>
                            <RipplePressable
                                style={[styles.tryOnButton, { borderColor: theme.border, backgroundColor: theme.background }, v.is_extracting && styles.tryOnButtonDisabled]}
                                onPress={() => { void handlePressTryOnButton(v); }}
                                disabled={v.is_extracting}
                            >
                                {v.is_extracting ? (
                                    <View style={styles.tryOnLoadingState}>
                                        <ActivityIndicator size="small" color={theme.primary} />
                                        <Text style={[styles.tryOnLoadingText, { color: theme.primary }]}>Extracting outfit...</Text>
                                    </View>
                                ) : v.extracted_outfit_url !== null ? (
                                    <View style={styles.tryOnPreviewState}>
                                        <Image source={{ uri: v.extracted_outfit_url }} style={styles.tryOnPreviewImage} contentFit="cover" />
                                        <Text style={[styles.tryOnButtonText, { color: theme.textPrimary }]}>Tap to replace or view fullscreen</Text>
                                    </View>
                                ) : (
                                    <Text style={[styles.tryOnButtonText, { color: theme.textSecondary }]}>Select image and extract outfit</Text>
                                )}
                            </RipplePressable>

                            <RipplePressable
                                style={[styles.savedExtractedButton, { borderColor: theme.border }]}
                                onPress={() => setSavedPickerVariantId(v.id)}
                                disabled={v.is_extracting}
                            >
                                <Text style={[styles.savedExtractedButtonText, { color: theme.textSecondary }]}>
                                    {isSavedExtractedLoading ? 'Loading saved extracted images...' : 'Use saved extracted image'}
                                </Text>
                            </RipplePressable>

                            {v.extraction_error ? (
                                <Text style={[styles.errorText, { color: theme.error }]}>{v.extraction_error}</Text>
                            ) : null}
                        </>
                    )}

                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, flex: 1, marginRight: 8 }]}
                            placeholder="Price (> 0)"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="numeric"
                            value={v.price}
                            onChangeText={(txt) => handleUpdate(v.id, 'price', txt)}
                        />
                        <TextInput
                            style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, flex: 1 }]}
                            placeholder="Stock"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="numeric"
                            value={v.stock}
                            onChangeText={(txt) => handleUpdate(v.id, 'stock', txt)}
                        />
                    </View>
                </View>
            ))}
            <RipplePressable
                style={[styles.addVariantBtn, { borderColor: theme.primary, borderStyle: 'dashed' }]}
                onPress={handleAdd}
            >
                <Text style={{ color: theme.primary }}>+ Add Variant</Text>
            </RipplePressable>

            <Modal
                transparent
                visible={activeVariant !== null}
                animationType="fade"
                onRequestClose={() => setActionVariantId(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.actionModalCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                        <Text style={[styles.actionModalTitle, { color: theme.textPrimary }]}>Variant Image Options</Text>

                        <RipplePressable
                            style={[styles.actionButton, { borderColor: theme.border }]}
                            onPress={() => {
                                const variantId = activeVariant?.id ?? null;
                                setActionVariantId(null);
                                if (variantId !== null) {
                                    void handlePickTryOnImage(variantId);
                                }
                            }}
                        >
                            <Text style={[styles.actionButtonText, { color: theme.textPrimary }]}>Replace Image</Text>
                        </RipplePressable>

                        <RipplePressable
                            style={[styles.actionButton, { borderColor: theme.border }]}
                            onPress={() => {
                                const variantId = activeVariant?.id ?? null;
                                setActionVariantId(null);
                                if (variantId !== null) {
                                    setSavedPickerVariantId(variantId);
                                }
                            }}
                        >
                            <Text style={[styles.actionButtonText, { color: theme.textPrimary }]}>Use Saved Extracted Image</Text>
                        </RipplePressable>

                        <RipplePressable
                            style={[styles.actionButton, { borderColor: theme.border }]}
                            onPress={() => {
                                const extractedOutfitUrl = activeVariant?.extracted_outfit_url ?? null;
                                if (extractedOutfitUrl !== null) {
                                    setFullscreenImageUrl(extractedOutfitUrl);
                                }
                                setActionVariantId(null);
                            }}
                        >
                            <Text style={[styles.actionButtonText, { color: theme.textPrimary }]}>View Fullscreen</Text>
                        </RipplePressable>

                        <RipplePressable
                            style={[styles.actionButton, { borderColor: theme.border }]}
                            onPress={() => setActionVariantId(null)}
                        >
                            <Text style={[styles.actionButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                        </RipplePressable>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                visible={savedPickerVariant !== null}
                animationType="fade"
                onRequestClose={() => setSavedPickerVariantId(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.actionModalCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                        <Text style={[styles.actionModalTitle, { color: theme.textPrimary }]}>Saved Extracted Images</Text>

                        <RipplePressable
                            style={[styles.actionButton, { borderColor: theme.border }]}
                            onPress={() => { void onRefreshSavedExtractedImages(); }}
                            disabled={isSavedExtractedLoading}
                        >
                            {isSavedExtractedLoading ? (
                                <ActivityIndicator size="small" color={theme.primary} />
                            ) : (
                                <Text style={[styles.actionButtonText, { color: theme.textPrimary }]}>Refresh List</Text>
                            )}
                        </RipplePressable>

                        <ScrollView style={styles.savedExtractedList} contentContainerStyle={styles.savedExtractedListContent}>
                            {!isSavedExtractedLoading && savedExtractedImages.length === 0 ? (
                                <Text style={[styles.savedExtractedEmptyText, { color: theme.textSecondary }]}>No saved extracted images yet.</Text>
                            ) : null}

                            {savedExtractedImages.map((savedImage) => (
                                <RipplePressable
                                    key={savedImage.storagePath}
                                    style={[styles.savedExtractedItem, { borderColor: theme.border }]}
                                    onPress={() => {
                                        if (savedPickerVariant === null) {
                                            return;
                                        }

                                        onSelectSavedExtractedImage(savedPickerVariant.id, savedImage);
                                        setSavedPickerVariantId(null);
                                    }}
                                >
                                    <Image source={{ uri: savedImage.publicUrl }} style={styles.savedExtractedItemImage} contentFit="cover" />
                                    <Text style={[styles.savedExtractedItemLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                                        {savedImage.label}
                                    </Text>
                                </RipplePressable>
                            ))}
                        </ScrollView>

                        <RipplePressable
                            style={[styles.actionButton, { borderColor: theme.border }]}
                            onPress={() => setSavedPickerVariantId(null)}
                        >
                            <Text style={[styles.actionButtonText, { color: theme.textSecondary }]}>Close</Text>
                        </RipplePressable>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={fullscreenImageUrl !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setFullscreenImageUrl(null)}
            >
                <View style={styles.fullscreenBackdrop}>
                    {fullscreenImageUrl !== null ? (
                        <Image source={{ uri: fullscreenImageUrl }} style={styles.fullscreenImage} contentFit="contain" />
                    ) : null}

                    <View style={styles.fullscreenActionRow}>
                        <RipplePressable
                            style={[styles.fullscreenActionButton, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                            onPress={() => { void handleOpenDownload(); }}
                        >
                            <Text style={[styles.fullscreenActionButtonText, { color: theme.textPrimary }]}>Download</Text>
                        </RipplePressable>

                        <RipplePressable
                            style={[styles.fullscreenActionButton, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                            onPress={() => setFullscreenImageUrl(null)}
                        >
                            <Text style={[styles.fullscreenActionButtonText, { color: theme.textPrimary }]}>Close</Text>
                        </RipplePressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    imageScroll: {
        paddingVertical: 8,
        gap: 12,
    },
    imageContainer: {
        width: 100,
        height: 100,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    removeBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 2,
    },
    addBtn: {
        width: 100,
        height: 100,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addBtnText: {
        fontSize: 12,
        marginTop: 4,
    },
    editorContainer: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    editor: {
        minHeight: 150,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        gap: 4,
    },
    tagText: {
        fontSize: 12,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
    },
    variantCard: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    variantHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    variantTitle: {
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
    },
    addVariantBtn: {
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 8,
    },
    checkboxRow: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    checkboxText: {
        fontSize: 13,
        fontWeight: '500',
    },
    helperText: {
        fontSize: 12,
        marginBottom: 8,
    },
    tryOnButton: {
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 80,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        overflow: 'hidden',
    },
    tryOnButtonDisabled: {
        opacity: 0.7,
    },
    tryOnButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    tryOnLoadingState: {
        alignItems: 'center',
        gap: 8,
    },
    tryOnLoadingText: {
        fontSize: 12,
        fontWeight: '600',
    },
    tryOnPreviewState: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 8,
    },
    tryOnPreviewImage: {
        width: '100%',
        height: 100,
    },
    savedExtractedButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
        marginBottom: 8,
    },
    savedExtractedButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 12,
        marginBottom: 8,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 24,
    },
    actionModalCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        gap: 10,
    },
    actionModalTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    actionButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    savedExtractedList: {
        maxHeight: 260,
    },
    savedExtractedListContent: {
        gap: 8,
        paddingVertical: 4,
    },
    savedExtractedEmptyText: {
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 10,
    },
    savedExtractedItem: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    savedExtractedItemImage: {
        width: 64,
        height: 64,
        borderRadius: 8,
    },
    savedExtractedItemLabel: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
    },
    fullscreenBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    fullscreenImage: {
        width: '100%',
        height: '75%',
    },
    fullscreenActionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    fullscreenActionButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    fullscreenActionButtonText: {
        fontSize: 14,
        fontWeight: '700',
    },
});

const richStyles = StyleSheet.create({
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    autoGenBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1.5,
        minWidth: 44,
        justifyContent: 'center',
    },
    autoGenBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
});
