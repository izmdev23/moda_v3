import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AccessibleTouchable } from './ui/accessible-touchable';
import { EmptyList } from './ui/empty-list';
import { useTheme } from './ui/theme-provider';

interface ShopBannerProps {
    shopName: string;
    location: string;
    description: string;
    followerCount: number;
    bannerUrl?: string;
    isOwner: boolean;
    isFollowing: boolean;
    onFollowToggle: () => void;
    onChatPress: () => void;
}

export const ShopBanner: React.FC<ShopBannerProps> = ({
    shopName,
    location,
    description,
    followerCount,
    bannerUrl,
    isOwner,
    isFollowing,
    onFollowToggle,
    onChatPress
}) => {
    const { theme } = useTheme();

    return (
        <View style={[styles.bannerContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
            <Image
                source={bannerUrl ? { uri: bannerUrl } : require('../assets/images/react-logo.png')} // placeholder
                style={styles.bannerImage}
                contentFit="cover"
            />
            <View style={styles.bannerContent}>
                <View style={styles.bannerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.shopName, { color: theme.textPrimary }]}>{shopName}</Text>
                        <View style={styles.locationRow}>
                            <MaterialIcons name="location-on" size={14} color={theme.textSecondary} />
                            <Text style={[styles.locationText, { color: theme.textSecondary }]}>{location}</Text>
                        </View>
                    </View>

                    {!isOwner && (
                        <View style={styles.actionsRow}>
                            <AccessibleTouchable
                                style={[styles.chatBtn, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                                onPress={onChatPress}
                                accessibilityLabel="Chat with Seller"
                            >
                                <MaterialIcons name="chat" size={18} color={theme.textPrimary} />
                            </AccessibleTouchable>
                            <AccessibleTouchable
                                style={[
                                    styles.followBtn,
                                    isFollowing ? { backgroundColor: theme.cardBackground, borderColor: theme.border } : { backgroundColor: theme.primary, borderColor: theme.primary }
                                ]}
                                onPress={onFollowToggle}
                                accessibilityLabel={isFollowing ? "Unfollow Shop" : "Follow Shop"}
                            >
                                <Text style={{ color: isFollowing ? theme.textPrimary : theme.white, fontWeight: 'bold', fontSize: 12 }}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Text>
                            </AccessibleTouchable>
                        </View>
                    )}
                </View>
                <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
                    {description}
                </Text>
                <Text style={[styles.followerCount, { color: theme.textPrimary }]}>
                    <Text style={{ fontWeight: 'bold' }}>{followerCount}</Text> Followers
                </Text>
            </View>
        </View>
    );
};

export type ShopTabType = 'All' | 'Tagged' | 'Best' | 'Analytics';

interface ShopTabsProps {
    activeTab: ShopTabType;
    onTabChange: (tab: ShopTabType) => void;
    isOwner: boolean;
}

export const ShopTabs: React.FC<ShopTabsProps> = ({ activeTab, onTabChange, isOwner }) => {
    const { theme } = useTheme();

    const tabs: ShopTabType[] = ['All', 'Tagged', 'Best'];
    if (isOwner) tabs.push('Analytics');

    return (
        <View style={[styles.tabsContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {tabs.map((tab) => {
                    let label = '';
                    switch (tab) {
                        case 'All': label = 'All Products'; break;
                        case 'Tagged': label = 'Tagged'; break;
                        case 'Best': label = 'Best Sellers'; break;
                        case 'Analytics': label = 'Analytics'; break;
                    }
                    const isActive = activeTab === tab;
                    return (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabBtn, isActive && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
                            onPress={() => onTabChange(tab)}
                        >
                            <Text style={[styles.tabText, { color: isActive ? theme.primary : theme.textSecondary, fontWeight: isActive ? 'bold' : 'normal' }]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

interface TaggedProductsListProps {
    shopUid: string;
}

export const TaggedProductsList: React.FC<TaggedProductsListProps> = ({ shopUid }) => {
    // Stub for tagged products implementation
    return (
        <View style={{ flex: 1, padding: 16 }}>
            <EmptyList icon="local-offer" message="No tags found" submessage="This shop hasn't tagged any products yet." />
        </View>
    );
};

export type TimeFilter = 'Today' | 'Week' | 'Month' | 'Year' | 'AllTime';

interface BestSellersFilterProps {
    onFilterChange: (filter: TimeFilter) => void;
}

export const BestSellersFilter: React.FC<BestSellersFilterProps> = ({ onFilterChange }) => {
    const { theme } = useTheme();
    const [active, setActive] = useState<TimeFilter>('AllTime');
    const filters: TimeFilter[] = ['Today', 'Week', 'Month', 'Year', 'AllTime'];

    const handlePress = (f: TimeFilter) => {
        setActive(f);
        onFilterChange(f);
    };

    return (
        <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {filters.map(f => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.chip, {
                            backgroundColor: active === f ? theme.primary + '20' : theme.cardBackground,
                            borderColor: active === f ? theme.primary : theme.border
                        }]}
                        onPress={() => handlePress(f)}
                    >
                        <Text style={{ color: active === f ? theme.primary : theme.textSecondary, fontSize: 12 }}>
                            {f === 'AllTime' ? 'All Time' : f}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

export const AnalyticsTab: React.FC = () => {
    // Stub for shop-analytics inline display
    return (
        <View style={{ flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' }}>
            <MaterialIcons name="insights" size={48} color="#ccc" />
            <Text style={{ marginTop: 16, fontSize: 16, color: '#333' }}>Analytics Dashboard Loading...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    bannerContainer: {
        borderBottomWidth: 1,
        paddingBottom: 16,
    },
    bannerImage: {
        width: '100%',
        height: 120,
        backgroundColor: '#E0E0E0',
    },
    bannerContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    bannerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    shopName: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationText: {
        fontSize: 12,
        marginLeft: 4,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    chatBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    followBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    description: {
        fontSize: 14,
        marginBottom: 8,
    },
    followerCount: {
        fontSize: 14,
    },
    tabsContainer: {
        borderBottomWidth: 1,
    },
    tabBtn: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    tabText: {
        fontSize: 14,
    },
    filterContainer: {
        paddingVertical: 12,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    }
});
