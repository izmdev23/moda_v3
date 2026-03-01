import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChatBubble, ChatInput, ChatMessageItem } from '../../components/chat-components';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { lightPalette } from '../../utils/theme';

export default function ChatThreadScreen() {
    const router = useRouter();
    const { thread_id, product_id } = useLocalSearchParams();

    const [messages, setMessages] = useState<ChatMessageItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [inputText, setInputText] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);

    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const loadMessages = async () => {
            try {
                // Mock message generation based on the thread
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Pretend this is fetched from supabase `chat_messages`
                const mockMessages: ChatMessageItem[] = [
                    {
                        uid: 'msg-3',
                        content: 'Your order has been shipped! Here is the tracking picture.',
                        imageUrl: 'https://picsum.photos/250',
                        timestamp: '10:30 AM',
                        isOwn: false,
                        isRead: true,
                    },
                    {
                        uid: 'msg-2',
                        content: 'When will it be shipped?',
                        imageUrl: null,
                        timestamp: 'Yesterday',
                        isOwn: true,
                        isRead: true,
                    },
                    {
                        uid: 'msg-1',
                        content: 'Thank you for your order!',
                        imageUrl: null,
                        timestamp: 'Yesterday',
                        isOwn: false,
                        isRead: true,
                    }
                ];

                setMessages(mockMessages);

                // Setup realtime subscription
                // const channel = supabase.channel(`chat_thread_${thread_id}`)
                //    .on('postgres_changes', ...)

                // Subscribe to realtime updates for new messages
            } catch (error) {
                console.error("Failed loading chat messages: ", error);
            } finally {
                setLoading(false);
            }
        };

        void loadMessages();
    }, [thread_id]);

    const handleSendText = async () => {
        if (!inputText.trim()) return;

        setIsSending(true);
        try {
            // Simulated delay for inserting into chat table
            await new Promise((resolve) => setTimeout(resolve, 500));

            const newMsg: ChatMessageItem = {
                uid: `msg-${Date.now()}`,
                content: inputText.trim(),
                imageUrl: null,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOwn: true,
                isRead: false, // Initially unread until the subscriber picks it up
            };

            setMessages((prev) => [newMsg, ...prev]);
            setInputText('');

            // Scroll to bottom after state updates
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
            console.error('Failed to send text', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleAttachImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets.length > 0) {
                const asset = result.assets[0];
                const uri = asset.uri;

                const manipResult = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: 800 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
                );

                // Assuming uploading then sending the message
                setIsSending(true);

                await new Promise((resolve) => setTimeout(resolve, 1000));

                const newMsg: ChatMessageItem = {
                    uid: `msg-${Date.now()}`,
                    content: null, // Just image
                    imageUrl: manipResult.uri,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isOwn: true,
                    isRead: false,
                };

                setMessages((prev) => [newMsg, ...prev]);
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                setIsSending(false);
            }
        } catch (error) {
            console.error('Error attaching image: ', error);
            Alert.alert("Error", "Could not attach image.");
            setIsSending(false);
        }
    };

    if (loading) {
        return (
            <SafeScreen>
                <View style={styles.center}>
                    <LoadingIndicator message="Loading discussion..." />
                </View>
            </SafeScreen>
        );
    }

    return (
        <SafeScreen>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={lightPalette.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>Seller / Buyer Name</Text>
                        <Text style={styles.headerSubtitle}>Active now</Text>
                    </View>
                </View>

                {product_id && (
                    <View style={styles.productBanner}>
                        <Ionicons name="pricetag-outline" size={16} color={lightPalette.textSecondary} />
                        <Text style={styles.productBannerText} numberOfLines={1}>
                            Talking about: Product ID {product_id}
                        </Text>
                    </View>
                )}

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.uid}
                    renderItem={({ item }) => <ChatBubble message={item} />}
                    inverted // Scroll up naturally
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />

                <ChatInput
                    value={inputText}
                    onChangeText={setInputText}
                    onSend={handleSendText}
                    onAttachImage={handleAttachImage}
                    isSending={isSending}
                />
            </KeyboardAvoidingView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
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
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
    },
    headerSubtitle: {
        fontSize: 12,
        color: lightPalette.success,
    },
    productBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E9ECEF',
    },
    productBannerText: {
        marginLeft: 8,
        fontSize: 13,
        color: lightPalette.textSecondary,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    listContent: {
        paddingVertical: 16,
    }
});
