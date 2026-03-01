import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { lightPalette } from '../utils/theme';

// ─── ReviewImageUploader ────────────────────────────────────────────────────
export interface ReviewImageUploaderProps {
    readonly images: string[];
    readonly onAddImage: (uri: string) => void;
    readonly onRemoveImage: (index: number) => void;
    readonly maxImages?: number;
}

export const ReviewImageUploader: React.FC<ReviewImageUploaderProps> = ({
    images,
    onAddImage,
    onRemoveImage,
    maxImages = 3,
}) => {
    const handlePickImage = async () => {
        if (images.length >= maxImages) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            onAddImage(result.assets[0].uri);
        }
    };

    return (
        <View style={uploaderStyles.container}>
            <Text style={uploaderStyles.label}>Photos ({images.length}/{maxImages})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={uploaderStyles.scroll}>
                {images.map((uri, index) => (
                    <View key={index} style={uploaderStyles.imageContainer}>
                        <Image source={{ uri }} style={uploaderStyles.image} />
                        <TouchableOpacity
                            style={uploaderStyles.removeBtn}
                            onPress={() => onRemoveImage(index)}
                        >
                            <Ionicons name="close-circle" size={24} color={lightPalette.error} />
                        </TouchableOpacity>
                    </View>
                ))}

                {images.length < maxImages && (
                    <TouchableOpacity style={uploaderStyles.addButton} onPress={handlePickImage} activeOpacity={0.7}>
                        <Ionicons name="camera-outline" size={32} color={lightPalette.textSecondary} />
                        <Text style={uploaderStyles.addText}>Add Photo</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
};

const uploaderStyles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
        marginBottom: 10,
    },
    scroll: {
        flexDirection: 'row',
        gap: 12,
    },
    imageContainer: {
        width: 100,
        height: 100,
        borderRadius: 8,
        position: 'relative',
    },
    image: {
        width: 100,
        height: 100,
        borderRadius: 8,
    },
    removeBtn: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    addButton: {
        width: 100,
        height: 100,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#E9ECEF',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    addText: {
        fontSize: 12,
        color: lightPalette.textSecondary,
        marginTop: 4,
    }
});

// ─── ReviewForm Component ───────────────────────────────────────────────────
export interface ReviewFormProps {
    readonly initialText?: string;
    readonly initialRating?: number;
    readonly onSubmit: (text: string, rating: number) => void;
    readonly isSubmitting?: boolean;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({
    initialText = '',
    initialRating = 0,
    onSubmit,
    isSubmitting = false,
}) => {
    const [text, setText] = useState(initialText);
    const [rating, setRating] = useState(initialRating);

    const isValid = text.trim().length > 0;

    return (
        <View style={formStyles.container}>
            <Text style={formStyles.label}>Your Rating</Text>
            <View style={formStyles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                        <Ionicons
                            name={star <= rating ? 'star' : 'star-outline'}
                            size={40}
                            color={star <= rating ? '#FFCC00' : '#E9ECEF'}
                        />
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={formStyles.label}>Your Review</Text>
            <View style={formStyles.inputContainer}>
                <TextInput
                    style={formStyles.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="What did you like or dislike?"
                    placeholderTextColor="#ADB5BD"
                    multiline
                    numberOfLines={5}
                    maxLength={500}
                    textAlignVertical="top"
                />
            </View>
            <Text style={formStyles.charCount}>{text.length}/500</Text>
        </View>
    );
};

const formStyles = StyleSheet.create({
    container: {
        marginBottom: 20,
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
    }
});
