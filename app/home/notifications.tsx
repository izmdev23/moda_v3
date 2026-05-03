import { RipplePressable } from '@/components/ui/ripple-pressable';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { AppNotificationItem, useBuyerNotifications, useMarkNotificationRead } from '../../hooks/use-refunds';

function formatNotificationDate(createdAt: string): string {
    const parsedDate = new Date(createdAt);
    if (Number.isNaN(parsedDate.getTime())) {
        return 'Just now';
    }

    return parsedDate.toLocaleString();
}

export default function NotificationsScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { data: currentUser } = useCurrentUser();
    const buyerUserId = currentUser?.id ?? null;
    const {
        data: notifications = [],
        isLoading,
        isRefetching,
        refetch,
    } = useBuyerNotifications(buyerUserId);
    const markNotificationReadMutation = useMarkNotificationRead();

    useFocusEffect(
        useCallback((): void => {
            if (buyerUserId === null) {
                return;
            }

            void refetch();
        }, [buyerUserId, refetch]),
    );

    const renderNotification = ({ item }: { item: AppNotificationItem }): React.JSX.Element => {
        return (
            <RipplePressable
                style={[
                    styles.notificationCard,
                    {
                        borderColor: theme.border,
                        backgroundColor: item.isRead ? theme.cardBackground : `${theme.primary}12`,
                    },
                ]}
                onPress={() => {
                    if (item.isRead) {
                        return;
                    }

                    markNotificationReadMutation.mutate({ notificationUid: item.uid });
                }}
            >
                <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                    {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
                </View>
                <Text style={[styles.notificationMessage, { color: theme.textSecondary }]}>{item.message}</Text>
                <Text style={[styles.notificationDate, { color: theme.textSecondary }]}>{formatNotificationDate(item.createdAt)}</Text>
            </RipplePressable>
        );
    };

    return (
        <SafeScreen style={styles.container}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}> 
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Notifications</Text>
            </View>

            <FlatList
                data={notifications}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={styles.listContent}
                renderItem={renderNotification}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={() => { void refetch(); }}
                        tintColor={theme.primary}
                    />
                }
                ListEmptyComponent={
                    isLoading
                        ? <View style={styles.loadingPlaceholder} />
                        : (
                            <EmptyList
                                icon={<MaterialIcons name="notifications-none" size={48} color={theme.textSecondary} />}
                                message="No notifications yet"
                                submessage="Refund updates and account alerts will appear here."
                            />
                        )
                }
            />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    listContent: {
        padding: 16,
        paddingBottom: 24,
    },
    loadingPlaceholder: {
        height: 10,
    },
    notificationCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginBottom: 10,
    },
    notificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    notificationTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        marginRight: 10,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    notificationMessage: {
        marginTop: 6,
        fontSize: 13,
        lineHeight: 18,
    },
    notificationDate: {
        marginTop: 8,
        fontSize: 11,
    },
});
