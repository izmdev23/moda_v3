import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
    AnalyticsTab,
    BestSellersFilter,
    ShopBanner,
    ShopTabs,
    ShopTabType,
    TaggedProductsList
} from '../../components/shop-landing-components';
import { EmptyList } from '../../components/ui/empty-list';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';

export default function ShopLandingScreen() {
    const { uid } = useLocalSearchParams();
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState<ShopTabType>('All');
    const [isFollowing, setIsFollowing] = useState(false);

    // Stub data for now
    const shopData = {
        name: 'Retro Revival',
        location: 'Quezon City, Philippines',
        description: 'Curated 90s vintage clothing.',
        followerCount: 230,
        isOwner: false // This would come from auth matching shop's owner_id
    };

    const handleFollowToggle = () => {
        setIsFollowing(!isFollowing);
        // Supabase follow logic would go here
    };

    const handleChatPress = () => {
        router.push('/home/chat-thread');
    };

    return (
        <SafeScreen style={styles.container}>
            <ShopBanner
                shopName={shopData.name}
                location={shopData.location}
                description={shopData.description}
                followerCount={shopData.followerCount}
                isOwner={shopData.isOwner}
                isFollowing={isFollowing}
                onFollowToggle={handleFollowToggle}
                onChatPress={handleChatPress}
            />
            <ShopTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isOwner={shopData.isOwner}
            />

            <View style={styles.tabContent}>
                {activeTab === 'All' && (
                    <EmptyList
                        icon="shopping-bag"
                        message="No products found"
                        submessage="This shop hasn't published anything yet."
                    />
                )}
                {activeTab === 'Tagged' && (
                    <TaggedProductsList shopUid={uid as string} />
                )}
                {activeTab === 'Best' && (
                    <View style={{ flex: 1 }}>
                        <BestSellersFilter onFilterChange={() => { }} />
                        <EmptyList
                            icon="trending-up"
                            message="No sales data yet"
                            submessage="This shop needs a few more sales to determine best sellers."
                        />
                    </View>
                )}
                {activeTab === 'Analytics' && shopData.isOwner && (
                    <AnalyticsTab />
                )}
            </View>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    tabContent: {
        flex: 1,
    }
});
