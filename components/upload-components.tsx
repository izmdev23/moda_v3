import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
                alert('Validation Error: Only JPG, PNG, and WEBP are allowed.');
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
                        <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(index)}>
                            <MaterialIcons name="close" size={16} color="white" />
                        </TouchableOpacity>
                    </View>
                ))}
                {images.length < maxCount && (
                    <TouchableOpacity
                        style={[styles.addBtn, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                        onPress={handlePick}
                    >
                        <MaterialIcons name="add-photo-alternate" size={32} color={theme.textSecondary} />
                        <Text style={[styles.addBtnText, { color: theme.textSecondary }]}>Add</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
};

interface RichTextInputProps {
    label: string;
    value: string;
    onChange: (text: string) => void;
}

export const RichTextInput: React.FC<RichTextInputProps> = ({ label, value, onChange }) => {
    const { theme } = useTheme();
    const editorRef = useRef<RichEditor>(null);

    React.useEffect(() => {
        if (editorRef.current && value) {
            // init
        }
    }, []);

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
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
                        <TouchableOpacity onPress={() => removeTag(i)}>
                            <MaterialIcons name="close" size={16} color={theme.primary} />
                        </TouchableOpacity>
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
}

interface VariantFieldGroupProps {
    variants: VariantData[];
    onChange: (variants: VariantData[]) => void;
}

export const VariantFieldGroup: React.FC<VariantFieldGroupProps> = ({ variants, onChange }) => {
    const { theme } = useTheme();

    const handleUpdate = (id: string, field: keyof VariantData, value: any) => {
        onChange(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    const handleRemove = (id: string) => {
        onChange(variants.filter(v => v.id !== id));
    };

    const handleAdd = () => {
        onChange([...variants, { id: Math.random().toString(), name: '', price: '', stock: '', sale_price: '', sale_end_date: undefined }]);
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.textPrimary }]}>Variants ({variants.length})</Text>
            {variants.map((v, i) => (
                <View key={v.id} style={[styles.variantCard, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}>
                    <View style={styles.variantHeader}>
                        <Text style={[styles.variantTitle, { color: theme.textPrimary }]}>Variant {i + 1}</Text>
                        {variants.length > 1 && (
                            <TouchableOpacity onPress={() => handleRemove(v.id)}>
                                <Text style={{ color: theme.error }}>Remove</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <TextInput
                        style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, marginBottom: 8 }]}
                        placeholder="Name (e.g. Red, XL)"
                        placeholderTextColor={theme.textSecondary}
                        value={v.name}
                        onChangeText={(txt) => handleUpdate(v.id, 'name', txt)}
                    />
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
            <TouchableOpacity
                style={[styles.addVariantBtn, { borderColor: theme.primary, borderStyle: 'dashed' }]}
                onPress={handleAdd}
            >
                <Text style={{ color: theme.primary }}>+ Add Variant</Text>
            </TouchableOpacity>
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
    }
});
