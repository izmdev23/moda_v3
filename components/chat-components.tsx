import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, FlatList, ListRenderItem, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { lightPalette } from '../utils/theme';
import { ImageWithFallback } from './ui/image-with-fallback';

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
    return (
        <TouchableOpacity style={threadStyles.container} onPress={onPress} activeOpacity={0.7}>
            {item.otherPartyAvatar ? (
                <ImageWithFallback src={item.otherPartyAvatar} style={threadStyles.avatar} />
            ) : (
                <View style={[threadStyles.avatar, threadStyles.avatarPlaceholder]}>
                    <Ionicons name="person" size={24} color="#FFFFFF" />
                </View>
            )}

            <View style={threadStyles.content}>
                <View style={threadStyles.header}>
                    <Text style={threadStyles.name} numberOfLines={1}>{item.otherPartyName}</Text>
                    <Text style={threadStyles.timestamp}>{item.timestamp}</Text>
                </View>

                <View style={threadStyles.messageRow}>
                    <Text
                        style={[threadStyles.message, item.unreadCount > 0 && threadStyles.messageUnread]}
                        numberOfLines={1}
                    >
                        {item.lastMessage}
                    </Text>

                    {item.unreadCount > 0 && (
                        <View style={threadStyles.badge}>
                            <Text style={threadStyles.badgeText}>{item.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const threadStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E9ECEF',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    avatarPlaceholder: {
        backgroundColor: '#ADB5BD',
        alignItems: 'center',
        justifyContent: 'center',
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
        color: lightPalette.textPrimary,
        marginRight: 8,
    },
    timestamp: {
        fontSize: 12,
        color: lightPalette.textSecondary,
    },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    message: {
        flex: 1,
        fontSize: 14,
        color: lightPalette.textSecondary,
        marginRight: 8,
    },
    messageUnread: {
        fontWeight: 'bold',
        color: lightPalette.textPrimary,
    },
    badge: {
        backgroundColor: lightPalette.primary,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#FFFFFF',
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
}

export interface ChatBubbleProps {
    readonly message: ChatMessageItem;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
    return (
        <View style={[bubbleStyles.container, message.isOwn ? bubbleStyles.ownContainer : bubbleStyles.otherContainer]}>
            <View style={[bubbleStyles.bubble, message.isOwn ? bubbleStyles.ownBubble : bubbleStyles.otherBubble]}>
                {message.imageUrl && (
                    <ImageWithFallback src={message.imageUrl} style={bubbleStyles.image} />
                )}

                {message.content && (
                    <Text style={[bubbleStyles.text, message.isOwn ? bubbleStyles.ownText : bubbleStyles.otherText]}>
                        {message.content}
                    </Text>
                )}
            </View>

            <View style={[bubbleStyles.footer, message.isOwn && bubbleStyles.ownFooter]}>
                <Text style={bubbleStyles.time}>{message.timestamp}</Text>
                {message.isOwn && (
                    <Ionicons
                        name={message.isRead ? "checkmark-done" : "checkmark"}
                        size={14}
                        color={message.isRead ? lightPalette.primary : "#ADB5BD"}
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
    ownBubble: {
        backgroundColor: lightPalette.primary,
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#E9ECEF',
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
    ownText: {
        color: '#FFFFFF',
    },
    otherText: {
        color: lightPalette.textPrimary,
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
        color: lightPalette.textSecondary,
    },
    readReceipt: {
        marginLeft: 4,
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
    const hasContent = value.trim().length > 0;

    return (
        <View style={inputStyles.wrapper}>
            <TouchableOpacity
                style={inputStyles.attachButton}
                onPress={onAttachImage}
                disabled={isSending}
                activeOpacity={0.7}
            >
                <Ionicons name="image-outline" size={24} color={lightPalette.textSecondary} />
            </TouchableOpacity>

            <View style={inputStyles.inputContainer}>
                <TextInput
                    style={inputStyles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder="Type a message..."
                    placeholderTextColor="#ADB5BD"
                    multiline
                    maxLength={1000}
                    editable={!isSending}
                />
            </View>

            <TouchableOpacity
                style={[
                    inputStyles.sendButton,
                    hasContent ? inputStyles.sendButtonActive : inputStyles.sendButtonInactive
                ]}
                onPress={onSend}
                disabled={!hasContent || isSending}
                activeOpacity={0.7}
            >
                {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <Ionicons name="send" size={18} color={hasContent ? '#FFFFFF' : '#ADB5BD'} />
                )}
            </TouchableOpacity>
        </View>
    );
};

const inputStyles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E9ECEF',
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
        backgroundColor: '#F8F9FA',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E9ECEF',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 8,
        paddingBottom: Platform.OS === 'ios' ? 12 : 8,
        minHeight: 44,
        maxHeight: 120,
    },
    input: {
        fontSize: 15,
        color: lightPalette.textPrimary,
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
    sendButtonActive: {
        backgroundColor: lightPalette.primary,
    },
    sendButtonInactive: {
        backgroundColor: '#E9ECEF',
    },
});

import { Platform } from 'react-native';
