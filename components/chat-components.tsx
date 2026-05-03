import { RipplePressable } from '@/components/ui/ripple-pressable';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, ListRenderItem, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { ImageWithFallback } from './ui/image-with-fallback';
import { useTheme } from './ui/theme-provider';

// ─── ChatThreadCard ─────────────────────────────────────────────────────────
export interface ChatThreadItem {
    readonly uid: string;
    readonly otherPartyName: string;
    readonly otherPartyAvatar: string | null;
    readonly lastMessage: string;
    readonly timestamp: string;
    readonly unreadCount: number;
}

export interface ChatThreadCardProps {
    readonly item: ChatThreadItem;
    readonly onPress: () => void;
}

export const ChatThreadCard: React.FC<ChatThreadCardProps> = ({ item, onPress }) => {
    const { theme } = useTheme();
    return (
        <RipplePressable style={[threadStyles.container, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]} onPress={onPress} activeOpacity={0.7}>
            {item.otherPartyAvatar ? (
                <ImageWithFallback src={item.otherPartyAvatar} style={threadStyles.avatar} />
            ) : (
                <View style={[threadStyles.avatar, { backgroundColor: theme.gray, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="person" size={24} color={theme.white} />
                </View>
            )}

            <View style={threadStyles.content}>
                <View style={threadStyles.header}>
                    <Text style={[threadStyles.name, { color: theme.textPrimary }]} numberOfLines={1}>{item.otherPartyName}</Text>
                    <Text style={[threadStyles.timestamp, { color: theme.textSecondary }]}>{item.timestamp}</Text>
                </View>

                <View style={threadStyles.messageRow}>
                    <Text
                        style={[threadStyles.message, { color: item.unreadCount > 0 ? theme.textPrimary : theme.textSecondary }, item.unreadCount > 0 && { fontWeight: 'bold' }]}
                        numberOfLines={1}
                    >
                        {item.lastMessage}
                    </Text>

                    {item.unreadCount > 0 && (
                        <View style={[threadStyles.badge, { backgroundColor: theme.primary }]}>
                            <Text style={[threadStyles.badgeText, { color: theme.white }]}>{item.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </View>
        </RipplePressable>
    );
};

const threadStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    name: {
        flex: 1,
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 8,
    },
    timestamp: {
        fontSize: 12,
    },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    message: {
        flex: 1,
        fontSize: 14,
        marginRight: 8,
    },
    badge: {
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
});

// ─── ChatThreadList ─────────────────────────────────────────────────────────
export interface ChatThreadListProps {
    readonly items: readonly ChatThreadItem[];
    readonly onThreadPress: (uid: string) => void;
    readonly ListEmptyComponent?: React.ReactElement;
}

export const ChatThreadList: React.FC<ChatThreadListProps> = ({ items, onThreadPress, ListEmptyComponent }) => {
    const renderItem: ListRenderItem<ChatThreadItem> = ({ item }) => (
        <ChatThreadCard item={item} onPress={() => onThreadPress(item.uid)} />
    );

    return (
        <FlatList
            data={items}
            keyExtractor={(item) => item.uid}
            renderItem={renderItem}
            ListEmptyComponent={ListEmptyComponent}
            contentContainerStyle={items.length === 0 ? listStyles.empty : undefined}
        />
    );
};

const listStyles = StyleSheet.create({
    empty: {
        flex: 1,
        justifyContent: 'center',
    }
});

// ─── ChatBubble ─────────────────────────────────────────────────────────────
export interface ChatMessageItem {
    readonly uid: string;
    readonly content: string | null;
    readonly imageUrl: string | null;
    readonly timestamp: string;
    readonly isOwn: boolean;
    readonly isRead: boolean;
    readonly messageType?: 'text' | 'image';
}

export interface ChatBubbleProps {
    readonly message: ChatMessageItem;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
    const { theme } = useTheme();

    const messageContent = message.content?.trim() ?? '';
    const isProductLink = messageContent.startsWith('[PRODUCT_LINK]');
    const isOrderLink = messageContent.startsWith('[ORDER_LINK]');

    const productLinkPayload = isProductLink
        ? messageContent.replace('[PRODUCT_LINK]', '').split('|')
        : [];
    const orderLinkPayload = isOrderLink
        ? messageContent.replace('[ORDER_LINK]', '').split('|')
        : [];

    const linkedProductUid = productLinkPayload[0] ?? '';
    const linkedProductName = productLinkPayload[1] ?? 'Linked Product';

    const linkedOrderUid = orderLinkPayload[0] ?? '';
    const linkedOrderItemUid = orderLinkPayload[1] ?? '';
    const linkedOrderProductName = orderLinkPayload[2] ?? 'Linked Order Item';
    const linkedOrderVariantName = orderLinkPayload[3] ?? '';
    const linkedOrderStatus = orderLinkPayload[4] ?? '';

    return (
        <View style={[bubbleStyles.container, message.isOwn ? bubbleStyles.ownContainer : bubbleStyles.otherContainer]}>
            <View style={[bubbleStyles.bubble, message.isOwn ? { backgroundColor: theme.primary, borderBottomRightRadius: 4 } : { backgroundColor: theme.cardBackground, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.border }]}>
                {message.imageUrl && (
                    <ImageWithFallback src={message.imageUrl} style={bubbleStyles.image} />
                )}

                {!isProductLink && !isOrderLink && message.content && (
                    <Text style={[bubbleStyles.text, { color: message.isOwn ? theme.white : theme.textPrimary }]}>
                        {message.content}
                    </Text>
                )}

                {isProductLink && (
                    <View style={[bubbleStyles.linkCard, { borderColor: message.isOwn ? `${theme.white}55` : theme.border, backgroundColor: message.isOwn ? `${theme.white}20` : theme.background }]}> 
                        <Text style={[bubbleStyles.linkLabel, { color: message.isOwn ? theme.white : theme.textSecondary }]}>Linked Product</Text>
                        <Text style={[bubbleStyles.linkTitle, { color: message.isOwn ? theme.white : theme.textPrimary }]} numberOfLines={2}>
                            {linkedProductName}
                        </Text>
                        <RipplePressable
                            style={[bubbleStyles.linkButton, { borderColor: message.isOwn ? theme.white : theme.primary }]}
                            onPress={() => {
                                if (linkedProductUid.length === 0) return;
                                router.push({ pathname: '/home/product-details', params: { uid: linkedProductUid } } as never);
                            }}
                        >
                            <Text style={[bubbleStyles.linkButtonText, { color: message.isOwn ? theme.white : theme.primary }]}>View Product</Text>
                        </RipplePressable>
                    </View>
                )}

                {isOrderLink && (
                    <View style={[bubbleStyles.linkCard, { borderColor: message.isOwn ? `${theme.white}55` : theme.border, backgroundColor: message.isOwn ? `${theme.white}20` : theme.background }]}> 
                        <Text style={[bubbleStyles.linkLabel, { color: message.isOwn ? theme.white : theme.textSecondary }]}>Linked Order</Text>
                        <Text style={[bubbleStyles.linkTitle, { color: message.isOwn ? theme.white : theme.textPrimary }]} numberOfLines={2}>
                            {linkedOrderProductName}{linkedOrderVariantName.length > 0 ? ` (${linkedOrderVariantName})` : ''}
                        </Text>
                        <Text style={[bubbleStyles.linkSubtext, { color: message.isOwn ? theme.white : theme.textSecondary }]} numberOfLines={1}>
                            {linkedOrderUid.length > 0 ? `Order #${linkedOrderUid}` : 'Order reference'}{linkedOrderStatus.length > 0 ? ` • ${linkedOrderStatus}` : ''}
                        </Text>
                        <RipplePressable
                            style={[bubbleStyles.linkButton, { borderColor: message.isOwn ? theme.white : theme.primary }]}
                            onPress={() => {
                                if (linkedOrderItemUid.length === 0) return;
                                router.push({ pathname: '/home/product-delivery-info', params: { orderId: linkedOrderItemUid } } as never);
                            }}
                        >
                            <Text style={[bubbleStyles.linkButtonText, { color: message.isOwn ? theme.white : theme.primary }]}>Open Order</Text>
                        </RipplePressable>
                    </View>
                )}
            </View>

            <View style={[bubbleStyles.footer, message.isOwn && bubbleStyles.ownFooter]}>
                <Text style={[bubbleStyles.time, { color: theme.textSecondary }]}>{message.timestamp}</Text>
                {message.isOwn && (
                    <Ionicons
                        name={message.isRead ? "checkmark-done" : "checkmark"}
                        size={14}
                        color={message.isRead ? theme.primary : theme.gray}
                        style={bubbleStyles.readReceipt}
                    />
                )}
            </View>
        </View>
    );
};

const bubbleStyles = StyleSheet.create({
    container: {
        marginVertical: 4,
        marginHorizontal: 16,
        maxWidth: '80%',
    },
    ownContainer: {
        alignSelf: 'flex-end',
    },
    otherContainer: {
        alignSelf: 'flex-start',
    },
    bubble: {
        padding: 12,
        borderRadius: 16,
        overflow: 'hidden',
    },
    image: {
        width: 200,
        height: 200,
        borderRadius: 8,
        marginBottom: 8,
    },
    text: {
        fontSize: 15,
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ownFooter: {
        justifyContent: 'flex-end',
    },
    time: {
        fontSize: 11,
    },
    readReceipt: {
        marginLeft: 4,
    },
    linkCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        gap: 6,
    },
    linkLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    linkTitle: {
        fontSize: 13,
        fontWeight: '700',
    },
    linkSubtext: {
        fontSize: 11,
    },
    linkButton: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    linkButtonText: {
        fontSize: 12,
        fontWeight: '700',
    },
});

// ─── ChatInput ──────────────────────────────────────────────────────────────
export interface ChatInputProps {
    readonly value: string;
    readonly onChangeText: (text: string) => void;
    readonly onSend: () => void;
    readonly onAttachImage: () => void;
    readonly isSending?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    value,
    onChangeText,
    onSend,
    onAttachImage,
    isSending = false
}) => {
    const { theme } = useTheme();
    const hasContent = value.trim().length > 0;

    return (
        <View style={[inputStyles.wrapper, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
            <RipplePressable
                style={inputStyles.attachButton}
                onPress={onAttachImage}
                disabled={isSending}
                activeOpacity={0.7}
            >
                <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
            </RipplePressable>

            <View style={[inputStyles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <TextInput
                    style={[inputStyles.input, { color: theme.textPrimary }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder="Type a message..."
                    placeholderTextColor={theme.gray}
                    multiline
                    maxLength={1000}
                    editable={!isSending}
                />
            </View>

            <RipplePressable
                style={[
                    inputStyles.sendButton,
                    { backgroundColor: hasContent ? theme.primary : theme.border }
                ]}
                onPress={onSend}
                disabled={!hasContent || isSending}
                activeOpacity={0.7}
            >
                {isSending ? (
                    <ActivityIndicator size="small" color={theme.white} />
                ) : (
                    <Ionicons name="send" size={18} color={hasContent ? theme.white : theme.gray} />
                )}
            </RipplePressable>
        </View>
    );
};

const inputStyles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    attachButton: {
        padding: 8,
        marginRight: 4,
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
    },
    inputContainer: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 8,
        paddingBottom: Platform.OS === 'ios' ? 12 : 8,
        minHeight: 44,
        maxHeight: 120,
    },
    input: {
        fontSize: 15,
        lineHeight: 20,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
});

