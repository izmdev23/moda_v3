import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { ChatBubble, ChatInput, ChatMessageItem } from '../../components/chat-components';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';

const THREAD_SKELETON_ROW_COUNT = 6;

function ThreadSkeleton(): React.JSX.Element {
    return (
        <View style={styles.threadSkeletonWrap}>
            {Array.from({ length: THREAD_SKELETON_ROW_COUNT }).map((_, index) => {
                const isOwnBubble = index % 2 === 0;

                return (
                    <View
                        key={`thread-skeleton-${index}`}
                        style={[styles.threadSkeletonRow, isOwnBubble ? styles.threadSkeletonOwn : styles.threadSkeletonOther]}
                    >
                        <SkeletonLoader
                            width={isOwnBubble ? '65%' : '72%'}
                            height={14}
                            style={styles.threadSkeletonLine}
                        />
                        <SkeletonLoader width={isOwnBubble ? '40%' : '35%'} height={14} />
                    </View>
                );
            })}
        </View>
    );
}

export default function ChatThreadScreen(): React.JSX.Element {
    const router = useRouter();
    const { theme } = useTheme();
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
        if (loading) return;
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
        if (loading) return;
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
            AppAlert.alert("Error", "Could not attach image.");
            setIsSending(false);
        }
    };

    return (
        <SafeScreen>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    <RipplePressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </RipplePressable>
                    <View style={styles.headerInfo}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Seller / Buyer Name</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.success }]}>Active now</Text>
                    </View>
                </View>

                {product_id && (
                    <View style={[styles.productBanner, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <Ionicons name="pricetag-outline" size={16} color={theme.textSecondary} />
                        <Text style={[styles.productBannerText, { color: theme.textSecondary }]} numberOfLines={1}>
                            Talking about: Product ID {product_id}
                        </Text>
                    </View>
                )}

                {loading ? (
                    <ThreadSkeleton />
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.uid}
                        renderItem={({ item }) => <ChatBubble message={item} />}
                        inverted // Scroll up naturally
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <ChatInput
                    value={inputText}
                    onChangeText={setInputText}
                    onSend={handleSendText}
                    onAttachImage={handleAttachImage}
                    isSending={isSending || loading}
                />
            </KeyboardAvoidingView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 12,
    },
    productBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    productBannerText: {
        marginLeft: 8,
        fontSize: 13,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    threadSkeletonWrap: {
        flex: 1,
        paddingTop: 18,
        paddingHorizontal: 16,
    },
    threadSkeletonRow: {
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
        maxWidth: '82%',
    },
    threadSkeletonOwn: {
        alignSelf: 'flex-end',
    },
    threadSkeletonOther: {
        alignSelf: 'flex-start',
    },
    threadSkeletonLine: {
        marginBottom: 8,
    },
    listContent: {
        paddingVertical: 16,
    }
});
