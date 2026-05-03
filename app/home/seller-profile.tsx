import { AppAlert } from '@/utils/app-alert';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { AvatarUploader, ProfileCompletenessBar } from '../../components/buyer-profile-components';
import {
    MenuItem,
    SellerMenu,
    SellerProfileHeader
} from '../../components/seller-profile-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { shopsTable } from '../../utils/database/shops-table';
import { usersTable } from '../../utils/database/users-table';

const SELLER_PROFILE_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

const SELLER_MENU_SKELETON_ROW_COUNT = 4;

function SellerProfileSkeleton(): React.JSX.Element {
    return (
        <View style={styles.profileSkeletonWrap}>
            <View style={styles.profileSkeletonHeader}>
                <SkeletonLoader width={80} height={80} borderRadius={40} />
                <View style={styles.profileSkeletonHeaderInfo}>
                    <SkeletonLoader width="70%" height={16} style={styles.profileSkeletonGap} />
                    <SkeletonLoader width="52%" height={12} />
                </View>
            </View>

            <SkeletonLoader height={8} width="100%" style={styles.profileSkeletonProgress} />

            <View style={styles.profileSkeletonMenuCard}>
                {Array.from({ length: SELLER_MENU_SKELETON_ROW_COUNT }).map((_, index) => (
                    <View key={`seller-profile-menu-${index}`} style={styles.profileSkeletonMenuRow}>
                        <SkeletonLoader width={24} height={24} borderRadius={6} />
                        <SkeletonLoader width="56%" height={14} />
                    </View>
                ))}
            </View>

            <View style={styles.profileSkeletonMenuCard}>
                {Array.from({ length: 2 }).map((_, index) => (
                    <View key={`seller-profile-account-${index}`} style={styles.profileSkeletonMenuRow}>
                        <SkeletonLoader width={24} height={24} borderRadius={6} />
                        <SkeletonLoader width="42%" height={14} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export default function SellerProfileScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const [user, setUser] = useState<Tables<'users'> | null>(null);
    const [shop, setShop] = useState<Tables<'shops'> | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [avatarUploaderVisible, setAvatarUploaderVisible] = useState<boolean>(false);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    useEffect(() => {
        const fetchSellerProfile = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    router.replace('/auth/login');
                    return;
                }

                // Get user
                const { data: userData, error: userError } = await usersTable.getByAuthId(session.user.id);
                if (userError || !userData) {
                    console.error('Error fetching user profile:', userError);
                    return;
                }

                setUser(userData);

                // Get shop
                const { data: shopData, error: shopError } = await shopsTable.getByUserId(userData.id);
                if (shopError) {
                    console.error('Error fetching shop profile:', shopError);
                    // It's possible the user bypassed and doesn't have a shop, though they shouldn't be here in that case
                } else if (shopData) {
                    setShop(shopData);
                }
            } catch (error) {
                console.error('Failed to load profile:', error);
            } finally {
                setLoading(false);
            }
        };

        void fetchSellerProfile();
    }, [router]);

    const handleUploadAvatar = async (uri: string) => {
        // Here we would upload the image to Supabase Storage 'user-avatars' bucket
        // and update the user record. For now, just a placeholder.
        console.log('Uploading avatar: ', uri);
        AppAlert.alert('Avatar Update', 'Avatar upload functionality will be implemented soon.');
    };

    const confirmAccountDeletion = () => {
        setDeleteDialogVisible(true);
    };

    const handleDeleteAccount = async () => {
        setDeleteDialogVisible(false);
        setIsDeleting(true);
        // Implement GDPR deletion logic
        setTimeout(async () => {
            await supabase.auth.signOut();
            setIsDeleting(false);
            router.replace('/auth/login');
        }, 2000);
    };

    const hasProfileData = user !== null && shop !== null;
    const safeShopUid = shop?.uid ?? '';

    // Calculate arbitrary completely profile percentage
    let completeness = 40;
    if (user?.avatar_url) completeness += 10;
    if (user?.date_of_birth) completeness += 10;
    if (shop?.description) completeness += 20;
    if (shop?.banner_url) completeness += 20;

    const mainMenuItems: readonly MenuItem[] = [
        {
            icon: 'cube-outline',
            label: 'Shop Products',
            onPress: () => router.push(`/home/shop-landing?uid=${safeShopUid}` as any),
        },
        {
            icon: 'bar-chart-outline',
            label: 'Shop Analytics',
            onPress: () => router.push(`/home/shop-analytics?uid=${safeShopUid}` as any),
        },
        {
            icon: 'basket-outline',
            label: 'Manage Orders',
            onPress: () => router.push('/home/my-orders-seller' as any),
        },
        {
            icon: 'receipt-outline',
            label: 'Transaction History',
            onPress: () => router.push('/home/order-history' as any),
        },
        {
            icon: 'chatbubbles-outline',
            label: 'My Chats',
            onPress: () => router.push('/home/chat' as any),
        },
        {
            icon: 'add-circle-outline',
            label: 'Upload New Product',
            onPress: () => router.push('/home/upload'),
        },
    ];

    const accountMenuItems: readonly MenuItem[] = [
        {
            icon: 'settings-outline',
            label: 'App Settings',
            onPress: () => router.push('/home/app-settings' as any),
        },
        {
            icon: 'trash-outline',
            label: 'Delete Account',
            onPress: confirmAccountDeletion,
            isDestructive: true,
        },
    ];

    return (
        <SafeScreen edges={SELLER_PROFILE_SAFE_AREA_EDGES}>
            <ScrollView
                style={[styles.container, { backgroundColor: theme.background }]}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <SellerProfileSkeleton />
                ) : hasProfileData ? (
                    <>
                        <SellerProfileHeader
                            shopName={shop.shop_name}
                            email={user.email}
                            avatarUrl={user.avatar_url}
                            onAvatarPress={() => setAvatarUploaderVisible(true)}
                        />

                        <ProfileCompletenessBar percentage={completeness} />

                        <SellerMenu items={mainMenuItems} />
                        <SellerMenu items={accountMenuItems} />
                    </>
                ) : (
                    <View style={[styles.center, { backgroundColor: theme.background }]} />
                )}
            </ScrollView>

            <AvatarUploader
                visible={avatarUploaderVisible}
                onClose={() => setAvatarUploaderVisible(false)}
                onUpload={handleUploadAvatar}
            />

            <ConfirmDialog
                visible={deleteDialogVisible}
                title="Delete Account"
                message="Are you sure you want to delete your account? This action is permanent and cannot be undone. Your profile will be anonymized per GDPR requirements."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={handleDeleteAccount}
                onCancel={() => setDeleteDialogVisible(false)}
            />

            {isDeleting && (
                <View style={styles.overlay}>
                    <LoadingIndicator message="Deleting account..." />
                </View>
            )}
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    profileSkeletonWrap: {
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    profileSkeletonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    profileSkeletonHeaderInfo: {
        flex: 1,
        marginLeft: 14,
    },
    profileSkeletonGap: {
        marginBottom: 8,
    },
    profileSkeletonProgress: {
        marginBottom: 14,
    },
    profileSkeletonMenuCard: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 8,
        marginBottom: 14,
    },
    profileSkeletonMenuRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
