import { AppAlert } from '@/utils/app-alert';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChatThreadItem, ChatThreadList } from '../../components/chat-components';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { supabase } from '../../supabase/supabaseClient';

const CHAT_SKELETON_ROW_COUNT = 6;

interface ChatThreadRow {
    readonly id: number;
    readonly uid: string;
    readonly buyer_id: number;
    readonly seller_id: number;
    readonly shop_id: number;
    readonly product_id: number | null;
    readonly last_message_at: string;
}

interface ChatMessageRow {
    readonly thread_id: number;
    readonly sender_id: number;
    readonly message_type: string;
    readonly content: string | null;
    readonly created_at: string;
    readonly read_at: string | null;
}

interface UserPreviewRow {
    readonly id: number;
    readonly first_name: string;
    readonly last_name: string;
    readonly avatar_url: string | null;
}

interface ShopPreviewRow {
    readonly id: number;
    readonly shop_name: string;
}

interface ProductPreviewRow {
    readonly id: number;
    readonly name: string;
}

function formatThreadTimestamp(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (isSameDay) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString();
}

function resolveThreadLastMessage(message: ChatMessageRow | null): string {
    if (message === null) {
        return 'No messages yet';
    }

    if (message.message_type.trim().toLowerCase() === 'image') {
        return 'Photo';
    }

    const content = message.content?.trim() ?? '';
    if (content.length === 0) {
        return 'Message';
    }

    if (content.startsWith('[PRODUCT_LINK]')) {
        return 'Linked a product';
    }

    if (content.startsWith('[ORDER_LINK]')) {
        return 'Linked an order';
    }

    return content;
}

function ChatThreadsSkeleton(): React.JSX.Element {
    return (
        <View style={styles.skeletonWrap}>
            {Array.from({ length: CHAT_SKELETON_ROW_COUNT }).map((_, index) => (
                <View key={`chat-skeleton-${index}`} style={styles.skeletonRow}>
                    <SkeletonLoader width={50} height={50} borderRadius={25} />
                    <View style={styles.skeletonBody}>
                        <SkeletonLoader width="55%" height={14} style={styles.skeletonLineGap} />
                        <SkeletonLoader width="80%" height={12} />
                    </View>
                </View>
            ))}
        </View>
    );
}

/** ChatScreen — displays all chat threads for the logged-in user. */
export default function ChatScreen(): React.JSX.Element {
    const router = useRouter();
    const { theme } = useTheme();
    const { data: currentUser } = useCurrentUser();
    const [threads, setThreads] = useState<ChatThreadItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchChatThreads = useCallback(async (): Promise<void> => {
        if (currentUser === null || currentUser === undefined) {
            setLoading(false);
            setThreads([]);
            return;
        }

        try {
            const { data: threadData, error: threadError } = await supabase
                .from('chat_threads')
                .select('id, uid, buyer_id, seller_id, shop_id, product_id, last_message_at')
                .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
                .order('last_message_at', { ascending: false });

            if (threadError !== null) {
                throw new Error(threadError.message);
            }

            const chatThreads = (threadData ?? []) as ChatThreadRow[];
            if (chatThreads.length === 0) {
                setThreads([]);
                return;
            }

            const threadIds = chatThreads.map((thread) => thread.id);
            const otherUserIds = Array.from(new Set(chatThreads.map((thread) => (
                thread.buyer_id === currentUser.id ? thread.seller_id : thread.buyer_id
            ))));
            const shopIds = Array.from(new Set(chatThreads.map((thread) => thread.shop_id)));
            const productIds = Array.from(new Set(
                chatThreads
                    .map((thread) => thread.product_id)
                    .filter((productId): productId is number => productId !== null),
            ));

            const [messagesResult, unreadResult, usersResult, shopsResult, productsResult] = await Promise.all([
                supabase
                    .from('chat_messages')
                    .select('thread_id, sender_id, message_type, content, created_at, read_at')
                    .in('thread_id', threadIds)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('chat_messages')
                    .select('thread_id, sender_id, message_type, content, created_at, read_at')
                    .in('thread_id', threadIds)
                    .neq('sender_id', currentUser.id)
                    .is('read_at', null),
                supabase
                    .from('users')
                    .select('id, first_name, last_name, avatar_url')
                    .in('id', otherUserIds),
                supabase
                    .from('shops')
                    .select('id, shop_name')
                    .in('id', shopIds),
                productIds.length === 0
                    ? Promise.resolve({ data: [] as ProductPreviewRow[], error: null })
                    : supabase
                        .from('products')
                        .select('id, name')
                        .in('id', productIds),
            ]);

            const messages = (messagesResult.data ?? []) as ChatMessageRow[];
            const unreadMessages = (unreadResult.data ?? []) as ChatMessageRow[];

            const lastMessageByThreadId = new Map<number, ChatMessageRow>();
            for (const message of messages) {
                if (!lastMessageByThreadId.has(message.thread_id)) {
                    lastMessageByThreadId.set(message.thread_id, message);
                }
            }

            const unreadByThreadId = new Map<number, number>();
            for (const unreadMessage of unreadMessages) {
                const previousCount = unreadByThreadId.get(unreadMessage.thread_id) ?? 0;
                unreadByThreadId.set(unreadMessage.thread_id, previousCount + 1);
            }

            const usersById = new Map<number, UserPreviewRow>();
            for (const userRow of (usersResult.data ?? []) as UserPreviewRow[]) {
                usersById.set(userRow.id, userRow);
            }

            const shopsById = new Map<number, ShopPreviewRow>();
            for (const shopRow of (shopsResult.data ?? []) as ShopPreviewRow[]) {
                shopsById.set(shopRow.id, shopRow);
            }

            const productsById = new Map<number, ProductPreviewRow>();
            for (const productRow of (productsResult.data ?? []) as ProductPreviewRow[]) {
                productsById.set(productRow.id, productRow);
            }

            const mappedThreads: ChatThreadItem[] = chatThreads.map((thread) => {
                const otherUserId = thread.buyer_id === currentUser.id ? thread.seller_id : thread.buyer_id;
                const otherUser = usersById.get(otherUserId) ?? null;
                const resolvedShopName = shopsById.get(thread.shop_id)?.shop_name ?? 'Shop';
                const resolvedProductName = thread.product_id === null
                    ? ''
                    : (productsById.get(thread.product_id)?.name ?? 'Product');
                const fullName = otherUser === null
                    ? ''
                    : `${otherUser.first_name.trim()} ${otherUser.last_name.trim()}`.trim();

                const otherPartyName = resolvedProductName.length > 0
                    ? `${resolvedShopName} - ${resolvedProductName}`
                    : fullName.length > 0
                        ? fullName
                        : currentUser.id === thread.buyer_id
                            ? resolvedShopName
                            : 'Buyer';

                const lastMessage = lastMessageByThreadId.get(thread.id) ?? null;
                const timestampSource = lastMessage?.created_at ?? thread.last_message_at;

                return {
                    uid: thread.uid,
                    otherPartyName,
                    otherPartyAvatar: otherUser?.avatar_url ?? null,
                    lastMessage: resolveThreadLastMessage(lastMessage),
                    timestamp: formatThreadTimestamp(timestampSource),
                    unreadCount: unreadByThreadId.get(thread.id) ?? 0,
                };
            });

            setThreads(mappedThreads);
        } catch (error) {
            console.error('Failed to load chat threads', error);
            AppAlert.alert('Error', 'Failed to load chat threads.');
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useFocusEffect(
        useCallback((): void => {
            setLoading(true);
            void fetchChatThreads();
        }, [fetchChatThreads]),
    );

    useEffect(() => {
        if (currentUser === null || currentUser === undefined) {
            return;
        }

        const channel = supabase
            .channel(`chat-list-${currentUser.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
            }, () => {
                void fetchChatThreads();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'chat_threads',
            }, () => {
                void fetchChatThreads();
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    void fetchChatThreads();
                }
            });

        return (): void => {
            void supabase.removeChannel(channel);
        };
    }, [currentUser, fetchChatThreads]);

    const handleThreadPress = (uid: string): void => {
        router.push({
            pathname: '/home/chat-thread',
            params: {
                threadUid: uid,
                attachProduct: 'false',
                linkProductUid: '',
                linkProductName: '',
            },
        } as never);
    };

    return (
        <SafeScreen>
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>My Chats</Text>
            </View>

            <View style={[styles.container, { backgroundColor: theme.background }]}>
                {loading ? (
                    <ChatThreadsSkeleton />
                ) : (
                    <ChatThreadList
                        items={threads}
                        onThreadPress={handleThreadPress}
                        ListEmptyComponent={
                            <EmptyList
                                icon={<Text style={styles.emptyIcon}>💬</Text>}
                                message="No messages yet"
                                submessage="Start a conversation with a seller to see it here."
                                actionButton={{
                                    label: 'Browse Products',
                                    onPress: () => router.push('/home/catalog' as never),
                                }}
                            />
                        }
                    />
                )}
            </View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skeletonWrap: {
        paddingTop: 8,
    },
    skeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    skeletonBody: {
        flex: 1,
        marginLeft: 12,
    },
    skeletonLineGap: {
        marginBottom: 8,
    },
    emptyIcon: {
        fontSize: 40,
    }
});
