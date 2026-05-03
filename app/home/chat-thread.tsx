import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { ChatBubble, ChatInput, ChatMessageItem } from '../../components/chat-components';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { supabase } from '../../supabase/supabaseClient';

const THREAD_SKELETON_ROW_COUNT = 6;
const CHAT_IMAGES_BUCKET = 'chat-images';
const REALTIME_FALLBACK_POLL_MS = 1000;

interface ChatThreadRow {
    readonly id: number;
    readonly uid: string;
    readonly buyer_id: number;
    readonly seller_id: number;
    readonly shop_id: number;
    readonly product_id: number | null;
}

interface ChatMessageRow {
    readonly uid: string;
    readonly content: string | null;
    readonly image_url: string | null;
    readonly message_type: string;
    readonly created_at: string;
    readonly sender_id: number;
    readonly read_at: string | null;
}

interface UserPreviewRow {
    readonly id: number;
    readonly first_name: string;
    readonly last_name: string;
    readonly avatar_url: string | null;
}

interface ProductPreviewRow {
    readonly uid: string;
    readonly name: string;
}

interface OrderRow {
    readonly id: number;
    readonly uid: string;
    readonly status: string;
}

interface OrderItemRow {
    readonly uid: string;
    readonly order_id: number;
    readonly product_name: string;
    readonly variant_name: string;
}

interface LinkableOrderItem {
    readonly orderUid: string;
    readonly orderItemUid: string;
    readonly productName: string;
    readonly variantName: string;
    readonly status: string;
}

interface SenderContext {
    readonly senderId: number;
    readonly authUid: string;
}

interface PendingLinkedProduct {
    readonly uid: string;
    readonly name: string;
}

function formatMessageTimestamp(isoDate: string): string {
    return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildChatMessage(messageRow: ChatMessageRow, currentUserId: number): ChatMessageItem {
    return {
        uid: messageRow.uid,
        content: messageRow.content,
        imageUrl: messageRow.image_url,
        timestamp: formatMessageTimestamp(messageRow.created_at),
        isOwn: messageRow.sender_id === currentUserId,
        isRead: messageRow.read_at !== null,
        messageType: messageRow.message_type.trim().toLowerCase() === 'image' ? 'image' : 'text',
    };
}

function dedupeMessagesByUid(items: readonly ChatMessageItem[]): ChatMessageItem[] {
    const seen = new Set<string>();
    const uniqueItems: ChatMessageItem[] = [];

    for (const item of items) {
        if (seen.has(item.uid)) {
            continue;
        }

        seen.add(item.uid);
        uniqueItems.push(item);
    }

    return uniqueItems;
}

function prependUniqueMessage(previousMessages: readonly ChatMessageItem[], nextMessage: ChatMessageItem): ChatMessageItem[] {
    if (previousMessages.some((message) => message.uid === nextMessage.uid)) {
        return [...previousMessages];
    }

    return [nextMessage, ...previousMessages];
}

function resolveImageExtension(uri: string): string {
    const dotIndex = uri.lastIndexOf('.');
    if (dotIndex === -1) {
        return 'jpg';
    }

    const extension = uri.slice(dotIndex + 1).toLowerCase();
    if (extension === 'png' || extension === 'webp' || extension === 'jpeg' || extension === 'jpg') {
        return extension;
    }

    return 'jpg';
}

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
    const { data: currentUser } = useCurrentUser();
    const {
        threadUid,
        thread_id,
        uid,
        attachProduct,
        linkProductUid,
        linkProductName,
    } = useLocalSearchParams<{
        threadUid?: string;
        thread_id?: string;
        uid?: string;
        attachProduct?: string;
        linkProductUid?: string;
        linkProductName?: string;
    }>();

    const shouldOfferProductAttachment = useMemo(() => {
        return typeof attachProduct === 'string' && attachProduct.trim().toLowerCase() === 'true';
    }, [attachProduct]);

    const normalizedThreadUid = useMemo(() => {
        if (typeof threadUid === 'string' && threadUid.trim().length > 0) return threadUid.trim();
        if (typeof thread_id === 'string' && thread_id.trim().length > 0) return thread_id.trim();
        if (typeof uid === 'string' && uid.trim().length > 0) return uid.trim();
        return '';
    }, [threadUid, thread_id, uid]);

    const [messages, setMessages] = useState<ChatMessageItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [inputText, setInputText] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);
    const [thread, setThread] = useState<ChatThreadRow | null>(null);
    const [otherPartyName, setOtherPartyName] = useState<string>('Chat');
    const [linkedProduct, setLinkedProduct] = useState<ProductPreviewRow | null>(null);
    const [isOrderPickerVisible, setIsOrderPickerVisible] = useState<boolean>(false);
    const [isOrderListLoading, setIsOrderListLoading] = useState<boolean>(false);
    const [linkableOrders, setLinkableOrders] = useState<readonly LinkableOrderItem[]>([]);
    const [isConversationReady, setIsConversationReady] = useState<boolean>(false);
    const [pendingLinkedProduct, setPendingLinkedProduct] = useState<PendingLinkedProduct | null>(null);

    const flatListRef = useRef<FlatList>(null);
    const isRefreshInFlightRef = useRef<boolean>(false);

    const canLinkOrders = currentUser !== null && thread !== null && currentUser.id === thread.buyer_id;

    const refreshMessages = useCallback(async (threadId: number, currentUserId: number): Promise<void> => {
        const { data: messageData, error: messageError } = await supabase
            .from('chat_messages')
            .select('uid, content, image_url, message_type, created_at, sender_id, read_at')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: false });

        if (messageError !== null) {
            throw new Error(messageError.message);
        }

        const mappedMessages = ((messageData ?? []) as ChatMessageRow[])
            .map((messageRow) => buildChatMessage(messageRow, currentUserId));
        setMessages(dedupeMessagesByUid(mappedMessages));

        await supabase
            .from('chat_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('thread_id', threadId)
            .neq('sender_id', currentUserId)
            .is('read_at', null);
    }, []);

    const loadLinkableOrders = useCallback(async (threadData: ChatThreadRow, buyerUserId: number): Promise<void> => {
        setIsOrderListLoading(true);

        try {
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('id, uid, status')
                .eq('buyer_id', buyerUserId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(40);

            if (orderError !== null) {
                throw new Error(orderError.message);
            }

            const orders = (orderData ?? []) as OrderRow[];
            if (orders.length === 0) {
                setLinkableOrders([]);
                return;
            }

            const orderIds = orders.map((order) => order.id);
            const orderUidById = new Map<number, { readonly orderUid: string; readonly status: string }>();
            for (const order of orders) {
                orderUidById.set(order.id, { orderUid: order.uid, status: order.status });
            }

            const { data: orderItemData, error: orderItemError } = await supabase
                .from('order_items')
                .select('uid, order_id, product_name, variant_name')
                .eq('shop_id', threadData.shop_id)
                .in('order_id', orderIds)
                .order('created_at', { ascending: false })
                .limit(50);

            if (orderItemError !== null) {
                throw new Error(orderItemError.message);
            }

            const mappedOrderItems: LinkableOrderItem[] = ((orderItemData ?? []) as OrderItemRow[])
                .map((orderItem) => {
                    const parentOrder = orderUidById.get(orderItem.order_id);
                    if (parentOrder === undefined) {
                        return null;
                    }

                    return {
                        orderUid: parentOrder.orderUid,
                        orderItemUid: orderItem.uid,
                        productName: orderItem.product_name,
                        variantName: orderItem.variant_name,
                        status: parentOrder.status,
                    } as LinkableOrderItem;
                })
                .filter((orderItem): orderItem is LinkableOrderItem => orderItem !== null);

            setLinkableOrders(mappedOrderItems);
        } catch (error) {
            console.error('Failed to load linkable orders', error);
            setLinkableOrders([]);
        } finally {
            setIsOrderListLoading(false);
        }
    }, []);

    const sendTextMessage = useCallback(async (content: string): Promise<void> => {
        if (thread === null || currentUser === null) {
            return;
        }

        const trimmedContent = content.trim();
        if (trimmedContent.length === 0) {
            return;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError !== null || sessionData.session === null) {
            throw new Error('Session expired. Please sign in again.');
        }

        const authUid = sessionData.session.user.id;
        const { data: senderUser, error: senderUserError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', authUid)
            .maybeSingle();

        if (senderUserError !== null || senderUser === null) {
            throw new Error('Unable to resolve authenticated sender.');
        }

        const senderId = senderUser.id;
        const isParticipant = senderId === thread.buyer_id || senderId === thread.seller_id;
        if (!isParticipant) {
            throw new Error('You are not allowed to send messages in this thread.');
        }

        const { data: insertedMessage, error: insertError } = await supabase
            .from('chat_messages')
            .insert({
                thread_id: thread.id,
                sender_id: senderId,
                message_type: 'text',
                content: trimmedContent,
            })
            .select('uid, content, image_url, message_type, created_at, sender_id, read_at')
            .single();

        if (insertError !== null) {
            throw new Error(insertError.message);
        }

        await supabase
            .from('chat_threads')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', thread.id);

        const mappedMessage = buildChatMessage(insertedMessage as ChatMessageRow, senderId);
        setMessages((previousMessages) => prependUniqueMessage(previousMessages, mappedMessage));
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, [currentUser, thread]);

    const sendProductLinkMessage = useCallback(async (productUidValue: string, productNameValue: string): Promise<void> => {
        const sanitizedName = productNameValue.replace(/\|/g, ' ').trim();
        await sendTextMessage(`[PRODUCT_LINK]${productUidValue}|${sanitizedName}`);
    }, [sendTextMessage]);

    const sendOrderLinkMessage = useCallback(async (orderItem: LinkableOrderItem): Promise<void> => {
        const payload = [
            orderItem.orderUid,
            orderItem.orderItemUid,
            orderItem.productName.replace(/\|/g, ' ').trim(),
            orderItem.variantName.replace(/\|/g, ' ').trim(),
            orderItem.status,
        ].join('|');

        await sendTextMessage(`[ORDER_LINK]${payload}`);
        setIsOrderPickerVisible(false);
    }, [sendTextMessage]);

    const handleAttachPendingProduct = useCallback(async (): Promise<void> => {
        if (pendingLinkedProduct === null || loading) {
            return;
        }

        setIsSending(true);
        try {
            await sendProductLinkMessage(pendingLinkedProduct.uid, pendingLinkedProduct.name);
            setPendingLinkedProduct(null);
        } catch (error) {
            console.error('Failed to attach linked product', error);
            AppAlert.alert('Error', 'Failed to attach product link. Please try again.');
        } finally {
            setIsSending(false);
        }
    }, [loading, pendingLinkedProduct, sendProductLinkMessage]);

    const resolveSenderContext = useCallback(async (): Promise<SenderContext> => {
        if (thread === null) {
            throw new Error('Chat thread is unavailable.');
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError !== null || sessionData.session === null) {
            throw new Error('Session expired. Please sign in again.');
        }

        const authUid = sessionData.session.user.id;
        const { data: senderUser, error: senderUserError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', authUid)
            .maybeSingle();

        if (senderUserError !== null || senderUser === null) {
            throw new Error('Unable to resolve authenticated sender.');
        }

        const senderId = senderUser.id;
        const isParticipant = senderId === thread.buyer_id || senderId === thread.seller_id;
        if (!isParticipant) {
            throw new Error('You are not allowed to send messages in this thread.');
        }

        return { senderId, authUid };
    }, [thread]);

    useEffect(() => {
        const loadConversation = async () => {
            setIsConversationReady(false);

            if (currentUser === null || currentUser === undefined) {
                setLoading(false);
                return;
            }

            if (normalizedThreadUid.length === 0) {
                AppAlert.alert('Error', 'Chat thread is missing.');
                setLoading(false);
                return;
            }

            try {
                const { data: threadData, error: threadError } = await supabase
                    .from('chat_threads')
                    .select('id, uid, buyer_id, seller_id, shop_id, product_id')
                    .eq('uid', normalizedThreadUid)
                    .maybeSingle();

                if (threadError !== null) {
                    throw new Error(threadError.message);
                }

                const resolvedThread = threadData as ChatThreadRow | null;
                if (resolvedThread === null) {
                    throw new Error('Chat thread not found.');
                }

                const isParticipant = resolvedThread.buyer_id === currentUser.id || resolvedThread.seller_id === currentUser.id;
                if (!isParticipant) {
                    throw new Error('You are not part of this conversation.');
                }

                setThread(resolvedThread);

                const otherUserId = resolvedThread.buyer_id === currentUser.id
                    ? resolvedThread.seller_id
                    : resolvedThread.buyer_id;

                const [userResult, productResult] = await Promise.all([
                    supabase
                        .from('users')
                        .select('id, first_name, last_name, avatar_url')
                        .eq('id', otherUserId)
                        .maybeSingle(),
                    resolvedThread.product_id === null
                        ? Promise.resolve({ data: null, error: null })
                        : supabase
                            .from('products')
                            .select('uid, name')
                            .eq('id', resolvedThread.product_id)
                            .is('deleted_at', null)
                            .maybeSingle(),
                ]);

                const otherUser = userResult.data as UserPreviewRow | null;
                const fullName = `${otherUser?.first_name?.trim() ?? ''} ${otherUser?.last_name?.trim() ?? ''}`.trim();
                setOtherPartyName(fullName.length > 0 ? fullName : 'Chat Participant');

                const linkedProductRow = productResult.data as ProductPreviewRow | null;
                setLinkedProduct(linkedProductRow);

                await refreshMessages(resolvedThread.id, currentUser.id);

                if (resolvedThread.buyer_id === currentUser.id) {
                    void loadLinkableOrders(resolvedThread, currentUser.id);
                } else {
                    setLinkableOrders([]);
                }

                setIsConversationReady(true);
            } catch (error) {
                console.error("Failed loading chat messages: ", error);
                const message = error instanceof Error ? error.message : 'Unable to open chat.';
                AppAlert.alert('Error', message, [{ text: 'OK', onPress: () => router.back() }]);
            } finally {
                setLoading(false);
            }
        };

        void loadConversation();
    }, [currentUser, loadLinkableOrders, normalizedThreadUid, refreshMessages, router]);

    useEffect(() => {
        if (!shouldOfferProductAttachment) {
            setPendingLinkedProduct(null);
            return;
        }

        if (typeof linkProductUid !== 'string' || linkProductUid.trim().length === 0) {
            setPendingLinkedProduct(null);
            return;
        }

        const productUidValue = linkProductUid.trim();
        const productNameValue = typeof linkProductName === 'string' && linkProductName.trim().length > 0
            ? linkProductName.trim()
            : 'Product';

        setPendingLinkedProduct({
            uid: productUidValue,
            name: productNameValue,
        });
    }, [linkProductName, linkProductUid, shouldOfferProductAttachment]);

    const safeRefreshMessages = useCallback(async (): Promise<void> => {
        if (thread === null || currentUser === null || !isConversationReady) {
            return;
        }

        if (isRefreshInFlightRef.current) {
            return;
        }

        isRefreshInFlightRef.current = true;

        try {
            await refreshMessages(thread.id, currentUser.id);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown refresh error';
            console.warn('Chat realtime fallback refresh failed:', message);
        } finally {
            isRefreshInFlightRef.current = false;
        }
    }, [currentUser, isConversationReady, refreshMessages, thread]);

    useEffect(() => {
        if (thread === null || currentUser === null) {
            return;
        }

        if (!isConversationReady) {
            return;
        }

        const channel = supabase
            .channel(`chat-thread-${thread.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `thread_id=eq.${thread.id}`,
            }, (payload) => {
                const insertedRow = payload.new as ChatMessageRow;
                const mappedMessage = buildChatMessage(insertedRow, currentUser.id);

                setMessages((previousMessages) => prependUniqueMessage(previousMessages, mappedMessage));

                if (insertedRow.sender_id !== currentUser.id) {
                    void supabase
                        .from('chat_messages')
                        .update({ read_at: new Date().toISOString() })
                        .eq('uid', insertedRow.uid)
                        .is('read_at', null);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    void safeRefreshMessages();
                }
            });

        return (): void => {
            void supabase.removeChannel(channel);
        };
    }, [currentUser, isConversationReady, safeRefreshMessages, thread]);

    useFocusEffect(
        useCallback(() => {
            if (thread === null || currentUser === null || !isConversationReady) {
                return undefined;
            }

            // Keep the thread fresh even if websocket delivery is delayed on mobile.
            void safeRefreshMessages();

            const intervalId: ReturnType<typeof setInterval> = setInterval(() => {
                void safeRefreshMessages();
            }, REALTIME_FALLBACK_POLL_MS);

            const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
                if (nextState === 'active') {
                    void safeRefreshMessages();
                }
            });

            return (): void => {
                clearInterval(intervalId);
                appStateSubscription.remove();
            };
        }, [currentUser, isConversationReady, safeRefreshMessages, thread]),
    );

    const handleSendText = async (): Promise<void> => {
        if (loading) return;
        if (!inputText.trim()) return;

        setIsSending(true);
        try {
            await sendTextMessage(inputText.trim());
            setInputText('');
        } catch (error) {
            console.error('Failed to send text', error);
            AppAlert.alert('Error', 'Failed to send message.');
        } finally {
            setIsSending(false);
        }
    };

    const handleAttachImage = async (): Promise<void> => {
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

                setIsSending(true);

                if (thread === null || currentUser === null) {
                    throw new Error('Unable to send image.');
                }

                const senderContext = await resolveSenderContext();

                const extension = resolveImageExtension(manipResult.uri);
                const filePath = `${senderContext.authUid}/${thread.uid}/${Date.now()}.${extension}`;

                const imageResponse = await fetch(manipResult.uri);
                const imageBuffer = await imageResponse.arrayBuffer();

                const { error: uploadError } = await supabase.storage
                    .from(CHAT_IMAGES_BUCKET)
                    .upload(filePath, imageBuffer, {
                        contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
                        upsert: false,
                    });

                if (uploadError !== null) {
                    throw new Error(uploadError.message);
                }

                const { data: publicUrlData } = supabase.storage.from(CHAT_IMAGES_BUCKET).getPublicUrl(filePath);

                const { data: insertedMessage, error: insertError } = await supabase
                    .from('chat_messages')
                    .insert({
                        thread_id: thread.id,
                        sender_id: senderContext.senderId,
                        message_type: 'image',
                        image_url: publicUrlData.publicUrl,
                        content: null,
                    })
                    .select('uid, content, image_url, message_type, created_at, sender_id, read_at')
                    .single();

                if (insertError !== null) {
                    throw new Error(insertError.message);
                }

                await supabase
                    .from('chat_threads')
                    .update({ last_message_at: new Date().toISOString() })
                    .eq('id', thread.id);

                const mappedMessage = buildChatMessage(insertedMessage as ChatMessageRow, senderContext.senderId);
                setMessages((previousMessages) => prependUniqueMessage(previousMessages, mappedMessage));
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }
        } catch (error) {
            console.error('Error attaching image: ', error);
            AppAlert.alert("Error", "Could not attach image.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <SafeScreen>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 16}
            >
                <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    <RipplePressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </RipplePressable>
                    <View style={styles.headerInfo}>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{otherPartyName}</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.success }]}>Active now</Text>
                    </View>
                </View>

                {linkedProduct !== null && (
                    <View style={[styles.productBanner, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <Ionicons name="pricetag-outline" size={16} color={theme.textSecondary} />
                        <Text style={[styles.productBannerText, { color: theme.textSecondary }]} numberOfLines={1}>
                            Talking about: {linkedProduct.name}
                        </Text>
                        <RipplePressable
                            style={[styles.bannerLinkButton, { borderColor: theme.primary }]}
                            onPress={() => router.push({ pathname: '/home/product-details', params: { uid: linkedProduct.uid } } as never)}
                        >
                            <Text style={[styles.bannerLinkButtonText, { color: theme.primary }]}>Open</Text>
                        </RipplePressable>
                    </View>
                )}

                {canLinkOrders && (
                    <View style={[styles.orderLinkRow, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}> 
                        <RipplePressable
                            style={[styles.orderLinkButton, { borderColor: theme.primary }]}
                            onPress={() => setIsOrderPickerVisible(true)}
                        >
                            <Ionicons name="receipt-outline" size={14} color={theme.primary} />
                            <Text style={[styles.orderLinkButtonText, { color: theme.primary }]}>Link My Order</Text>
                        </RipplePressable>
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
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {pendingLinkedProduct !== null && (
                    <View style={[styles.pendingAttachmentRow, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}> 
                        <Ionicons name="attach-outline" size={14} color={theme.textSecondary} />
                        <Text style={[styles.pendingAttachmentText, { color: theme.textPrimary }]} numberOfLines={1}>
                            Attachment: {pendingLinkedProduct.name}
                        </Text>
                        <RipplePressable
                            style={[styles.pendingAttachmentButton, { borderColor: theme.primary }]}
                            onPress={() => { void handleAttachPendingProduct(); }}
                        >
                            <Text style={[styles.pendingAttachmentButtonText, { color: theme.primary }]}>Attach</Text>
                        </RipplePressable>
                        <RipplePressable
                            style={styles.pendingAttachmentDismiss}
                            onPress={() => setPendingLinkedProduct(null)}
                        >
                            <Ionicons name="close" size={16} color={theme.textSecondary} />
                        </RipplePressable>
                    </View>
                )}

                <ChatInput
                    value={inputText}
                    onChangeText={setInputText}
                    onSend={handleSendText}
                    onAttachImage={handleAttachImage}
                    isSending={isSending || loading}
                />

                <Modal
                    visible={isOrderPickerVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIsOrderPickerVisible(false)}
                >
                    <View style={styles.orderPickerOverlay}>
                        <View style={[styles.orderPickerCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                            <View style={styles.orderPickerHeader}>
                                <Text style={[styles.orderPickerTitle, { color: theme.textPrimary }]}>Link Order</Text>
                                <RipplePressable onPress={() => setIsOrderPickerVisible(false)} style={styles.orderPickerCloseButton}>
                                    <Ionicons name="close" size={18} color={theme.textPrimary} />
                                </RipplePressable>
                            </View>

                            {isOrderListLoading ? (
                                <View style={styles.orderPickerLoading}>
                                    <SkeletonLoader width="100%" height={60} borderRadius={10} style={styles.orderPickerLoadingGap} />
                                    <SkeletonLoader width="100%" height={60} borderRadius={10} />
                                </View>
                            ) : linkableOrders.length === 0 ? (
                                <View style={styles.orderPickerEmpty}>
                                    <Text style={[styles.orderPickerEmptyText, { color: theme.textSecondary }]}>No orders available to link for this shop.</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={linkableOrders}
                                    keyExtractor={(item) => `${item.orderItemUid}-${item.orderUid}`}
                                    style={styles.orderPickerList}
                                    renderItem={({ item }) => (
                                        <RipplePressable
                                            style={[styles.orderItemCard, { borderColor: theme.border, backgroundColor: theme.background }]}
                                            onPress={() => {
                                                void (async (): Promise<void> => {
                                                    try {
                                                        await sendOrderLinkMessage(item);
                                                    } catch (error) {
                                                        console.error('Failed to link order', error);
                                                        AppAlert.alert('Error', 'Failed to link order. Please try again.');
                                                    }
                                                })();
                                            }}
                                        >
                                            <Text style={[styles.orderItemTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                                                {item.productName} ({item.variantName})
                                            </Text>
                                            <Text style={[styles.orderItemMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                                                Order #{item.orderUid} • {item.status}
                                            </Text>
                                        </RipplePressable>
                                    )}
                                />
                            )}
                        </View>
                    </View>
                </Modal>
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
        flex: 1,
    },
    bannerLinkButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    bannerLinkButtonText: {
        fontSize: 12,
        fontWeight: '700',
    },
    orderLinkRow: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    orderLinkButton: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    orderLinkButtonText: {
        fontSize: 12,
        fontWeight: '700',
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
    },
    pendingAttachmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    pendingAttachmentText: {
        flex: 1,
        fontSize: 12,
    },
    pendingAttachmentButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    pendingAttachmentButtonText: {
        fontSize: 12,
        fontWeight: '700',
    },
    pendingAttachmentDismiss: {
        padding: 2,
    },
    orderPickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 18,
    },
    orderPickerCard: {
        borderRadius: 14,
        borderWidth: 1,
        maxHeight: '70%',
        overflow: 'hidden',
    },
    orderPickerHeader: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderPickerTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    orderPickerCloseButton: {
        padding: 2,
    },
    orderPickerLoading: {
        padding: 14,
    },
    orderPickerLoadingGap: {
        marginBottom: 10,
    },
    orderPickerEmpty: {
        padding: 18,
    },
    orderPickerEmptyText: {
        fontSize: 13,
    },
    orderPickerList: {
        paddingHorizontal: 14,
        paddingBottom: 12,
    },
    orderItemCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
    },
    orderItemTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 3,
    },
    orderItemMeta: {
        fontSize: 12,
    },
});
