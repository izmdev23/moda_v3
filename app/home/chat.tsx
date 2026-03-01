import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ChatThreadItem, ChatThreadList } from '../../components/chat-components';
import { EmptyList } from '../../components/ui/empty-list';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { supabase } from '../../supabase/supabaseClient';
import { lightPalette } from '../../utils/theme';

export default function ChatScreen() {
    const router = useRouter();
    const [threads, setThreads] = useState<ChatThreadItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchChatThreads = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    router.replace('/auth/login');
                    return;
                }

                // Temporary mock data mapping
                // For realism, this would interact with chat_threads table and JOIN user information
                await new Promise((resolve) => setTimeout(resolve, 600)); // Simulate network request

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

    const handleThreadPress = (uid: string) => {
        // We typecast as any to bypass expo-router types not picking up dynamic routing correctly 
        // until the app restarts or we run a typegen script
        router.push(`/home/chat-thread?thread_id=${uid}` as any);
    };

    if (loading) {
        return (
            <SafeScreen>
                <View style={styles.center}>
                    <LoadingIndicator message="Loading chats..." />
                </View>
            </SafeScreen>
        );
    }

    return (
        <SafeScreen>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Chats</Text>
            </View>

            <View style={styles.container}>
                <ChatThreadList
                    items={threads}
                    onThreadPress={handleThreadPress}
                    ListEmptyComponent={
                        <EmptyList
                            icon="chatbubbles-outline"
                            message="No messages yet"
                            submessage="Start a conversation with a seller to see it here."
                            actionButton={{
                                label: "Browse Products",
                                onPress: () => router.push('/home/catalog' as any)
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
        backgroundColor: '#F8F9FA',
    },
    header: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E9ECEF',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    }
});
