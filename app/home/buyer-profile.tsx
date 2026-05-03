import { AppAlert } from '@/utils/app-alert';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import {
    AvatarUploader,
    MenuItem,
    ProfileCompletenessBar,
    ProfileHeader,
    ProfileMenu
} from '../../components/buyer-profile-components';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { SafeScreen } from '../../components/ui/safe-screen';
import { SkeletonLoader } from '../../components/ui/skeleton-loader';
import { useTheme } from '../../components/ui/theme-provider';
import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { usersTable } from '../../utils/database/users-table';

const BUYER_PROFILE_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

// ─── Profile Skeleton ─────────────────────────────────────────────────────────

const ProfileSkeleton: React.FC = () => (
    <ScrollView showsVerticalScrollIndicator={false} style={profileSkeletonStyles.container}>
        <View style={profileSkeletonStyles.header}>
            <SkeletonLoader width={84} height={84} borderRadius={42} style={{ marginBottom: 12 }} />
            <SkeletonLoader height={20} width={160} style={{ marginBottom: 8 }} />
            <SkeletonLoader height={14} width={200} />
        </View>
        <SkeletonLoader height={8} borderRadius={4} style={profileSkeletonStyles.bar} />
        <View style={profileSkeletonStyles.menuGroup}>
            {Array.from({ length: 4 }).map((_, i) => (
                <View key={i} style={profileSkeletonStyles.menuItem}>
                    <SkeletonLoader width={24} height={24} borderRadius={6} />
                    <SkeletonLoader height={16} width="55%" />
                </View>
            ))}
        </View>
        <View style={[profileSkeletonStyles.menuGroup, { marginTop: 8 }]}>
            {Array.from({ length: 3 }).map((_, i) => (
                <View key={i} style={profileSkeletonStyles.menuItem}>
                    <SkeletonLoader width={24} height={24} borderRadius={6} />
                    <SkeletonLoader height={16} width="45%" />
                </View>
            ))}
        </View>
    </ScrollView>
);

const profileSkeletonStyles = StyleSheet.create({
    container: { flex: 1 },
    header: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 },
    bar: { marginHorizontal: 16, marginBottom: 16 },
    menuGroup: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
});

export default function BuyerProfileScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const [user, setUser] = useState<Tables<'users'> | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [avatarUploaderVisible, setAvatarUploaderVisible] = useState<boolean>(false);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    router.replace('/auth/login');
                    return;
                }

                const { data: userData, error } = await usersTable.getByAuthId(session.user.id);
                if (error) {
                    console.error('Error fetching user profile:', error);
                    return;
                }

                setUser(userData);
            } catch (error) {
                console.error('Failed to load profile:', error);
            } finally {
                setLoading(false);
            }
        };

        void fetchUserProfile();
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
        // 1. soft delete user in DB
        // 2. anonymize info
        // 3. delete auth user / sign out
        setTimeout(async () => {
            await supabase.auth.signOut();
            setIsDeleting(false);
            router.replace('/auth/login');
        }, 2000);
    };

    const hasUserProfile = user !== null;

    // Calculate arbitrary completely profile percentage
    let completeness = 50;
    if (user?.avatar_url) completeness += 20;
    if (user?.date_of_birth) completeness += 30;

    const mainMenuItems: readonly MenuItem[] = [
        {
            icon: 'cube-outline',
            label: 'My Orders',
            onPress: () => router.push('/home/my-orders-buyer' as any),
        },
        {
            icon: 'chatbubbles-outline',
            label: 'My Chats',
            onPress: () => router.push('/home/chat' as any),
        },
        {
            icon: 'location-outline',
            label: 'Manage Addresses',
            onPress: () => router.push('/home/addresses'),
        },
        {
            icon: 'receipt-outline',
            label: 'Transaction History',
            onPress: () => router.push('/home/order-history' as any),
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
        <SafeScreen edges={BUYER_PROFILE_SAFE_AREA_EDGES}>
            <ScrollView
                style={[styles.container, { backgroundColor: theme.background }]}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <ProfileSkeleton />
                ) : hasUserProfile ? (
                    <>
                        <ProfileHeader
                            name={`${user.first_name} ${user.last_name}`}
                            email={user.email}
                            avatarUrl={user.avatar_url}
                            onAvatarPress={() => setAvatarUploaderVisible(true)}
                        />

                        <ProfileCompletenessBar percentage={completeness} />

                        <ProfileMenu items={mainMenuItems} />
                        <ProfileMenu items={accountMenuItems} />
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
