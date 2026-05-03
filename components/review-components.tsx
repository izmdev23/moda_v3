import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RipplePressable } from '@/components/ui/ripple-pressable';
import { useTheme } from './ui/theme-provider';

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
    const { theme } = useTheme();
    const handlePickImage = async (): Promise<void> => {
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
            <Text style={[uploaderStyles.label, { color: theme.textPrimary }]}>Photos ({images.length}/{maxImages})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={uploaderStyles.scroll}>
                {images.map((uri, index) => (
                    <View key={index} style={uploaderStyles.imageContainer}>
                        <Image source={{ uri }} style={uploaderStyles.image} />
                        <RipplePressable
                            style={[uploaderStyles.removeBtn, { backgroundColor: theme.white }]}
                            onPress={() => onRemoveImage(index)}
                        >
                            <Ionicons name="close-circle" size={24} color={theme.error} />
                        </RipplePressable>
                    </View>
                ))}

                {images.length < maxImages && (
                    <RipplePressable style={[uploaderStyles.addButton, { borderColor: theme.border, backgroundColor: theme.background }]} onPress={handlePickImage} activeOpacity={0.7}>
                        <Ionicons name="camera-outline" size={32} color={theme.textSecondary} />
                        <Text style={[uploaderStyles.addText, { color: theme.textSecondary }]}>Add Photo</Text>
                    </RipplePressable>
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
        borderRadius: 12,
    },
    addButton: {
        width: 100,
        height: 100,
        borderRadius: 8,
        borderWidth: 2,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addText: {
        fontSize: 12,
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
    const { theme } = useTheme();
    const [text, setText] = useState<string>(initialText);
    const [rating, setRating] = useState<number>(initialRating);

    const isValid = text.trim().length > 0;
    void isSubmitting;
    void onSubmit;
    void isValid;

    return (
        <View style={formStyles.container}>
            <Text style={[formStyles.label, { color: theme.textPrimary }]}>Your Rating</Text>
            <View style={formStyles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <RipplePressable key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                        <Ionicons
                            name={star <= rating ? 'star' : 'star-outline'}
                            size={40}
                            color={star <= rating ? theme.starColor : theme.border}
                        />
                    </RipplePressable>
                ))}
            </View>

            <Text style={[formStyles.label, { color: theme.textPrimary }]}>Your Review</Text>
            <View style={[formStyles.inputContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <TextInput
                    style={[formStyles.input, { color: theme.textPrimary }]}
                    value={text}
                    onChangeText={setText}
                    placeholder="What did you like or dislike?"
                    placeholderTextColor={theme.gray}
                    multiline
                    numberOfLines={5}
                    maxLength={500}
                    textAlignVertical="top"
                />
            </View>
            <Text style={[formStyles.charCount, { color: theme.textSecondary }]}>{text.length}/500</Text>
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
    }
});
