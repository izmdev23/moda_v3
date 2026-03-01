import { router } from 'expo-router';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FormInput } from '../../components/ui/form-input';
import { useTheme } from '../../components/ui/theme-provider';
import { ImageDetail, ImageUploader, RichTextInput, TagsInput, VariantData, VariantFieldGroup } from '../../components/upload-components';

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

    const { control, handleSubmit, formState: { errors } } = useForm({
        defaultValues: { name: '', category: '' }
    });

    const onSubmit = async (data: any) => {
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

        try {
            setIsLoading(true);
            // TODO: API logic to upload to Supabase and insert product & variants
            setTimeout(() => {
                setIsLoading(false);
                Alert.alert('Success', 'Product published successfully!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            }, 2000);
        } catch (e: any) {
            setIsLoading(false);
            Alert.alert('Error', e.message);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
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

                <FormInput
                    control={control}
                    name="category"
                    label="Category"
                    placeholder="Tops, Bottoms, Footwear..."
                    rules={{ required: 'Category is required' }}
                    error={errors.category?.message as string}
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

                <RichTextInput
                    label="Description"
                    value={description}
                    onChange={setDescription}
                />

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
    );
}

const styles = StyleSheet.create({
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
    }
});
