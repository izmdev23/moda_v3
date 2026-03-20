import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ChatThreadItem, ChatThreadList } from '../../components/chat-components';
import { EmptyList } from '../../components/ui/empty-list';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { supabase } from '../../supabase/supabaseClient';

/** ChatScreen — displays all chat threads for the logged-in user. */
export default function ChatScreen(): React.JSX.Element {
    const router = useRouter();
    const { theme } = useTheme();
    const [threads, setThreads] = useState<ChatThreadItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchChatThreads = async (): Promise<void> => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    router.replace('/auth/login');
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, 600));

                const mockThreads: ChatThreadItem[] = [
                    {
                        uid: 'thread-1',
                        otherPartyName: 'Vintage Clothes PH',
                        otherPartyAvatar: 'https://picsum.photos/100',
                        lastMessage: 'Your order has been shipped!',
                        timestamp: '10:30 AM',
                        unreadCount: 1,
                    },
                    {
                        uid: 'thread-2',
                        otherPartyName: 'John Doe',
                        otherPartyAvatar: 'https://picsum.photos/101',
                        lastMessage: 'Is this item still available?',
                        timestamp: 'Yesterday',
                        unreadCount: 0,
                    }
                ];

                setThreads(mockThreads);
            } catch (error) {
                console.error('Failed to load chat threads', error);
                Alert.alert('Error', 'Failed to load chat threads.');
            } finally {
                setLoading(false);
            }
        };

        void fetchChatThreads();
    }, [router]);

    const handleThreadPress = (uid: string): void => {
        router.push(`/home/chat-thread?thread_id=${uid}` as never);
    };

    if (loading) {
        return (
            <SafeScreen>
                <View style={[styles.center, { backgroundColor: theme.background }]}>
                    <LoadingIndicator message="Loading chats..." />
                </View>
            </SafeScreen>
        );
    }

    return (
        <SafeScreen>
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>My Chats</Text>
            </View>

            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <ChatThreadList
                    items={threads}
                    onThreadPress={handleThreadPress}
                    ListEmptyComponent={
                        <EmptyList
                            icon={<Text style={styles.emptyIcon}>💬</Text>}
                            message="No messages yet"
                            submessage="Start a conversation with a seller to see it here."
                            actionButton={{
                                label: "Browse Products",
                                onPress: () => router.push('/home/catalog' as never)
                            }}
                        />
                    }
                />
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
    emptyIcon: {
        fontSize: 40,
    }
});
