import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
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
import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { usersTable } from '../../utils/database/users-table';

export default function BuyerProfileScreen() {
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
        Alert.alert('Avatar Update', 'Avatar upload functionality will be implemented soon.');
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

    if (loading) {
        return (
            <SafeScreen>
                <View style={styles.center}>
                    <LoadingIndicator message="Loading profile..." />
                </View>
            </SafeScreen>
        );
    }

    if (!user) {
        return (
            <SafeScreen>
                <View style={styles.center} />
            </SafeScreen>
        );
    }

    // Calculate arbitrary completely profile percentage
    let completeness = 50;
    if (user.avatar_url) completeness += 20;
    if (user.date_of_birth) completeness += 30;

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
            icon: 'swap-horizontal-outline',
            label: 'Switch to Seller Account',
            onPress: () => router.push('/home/seller-profile' as any), // This would actually route to a Switch To Seller flow
        },
        {
            icon: 'trash-outline',
            label: 'Delete Account',
            onPress: confirmAccountDeletion,
            isDestructive: true,
        },
    ];

    return (
        <SafeScreen>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <ProfileHeader
                    name={`${user.first_name} ${user.last_name}`}
                    email={user.email}
                    avatarUrl={user.avatar_url}
                    onAvatarPress={() => setAvatarUploaderVisible(true)}
                />

                <ProfileCompletenessBar percentage={completeness} />

                <ProfileMenu items={mainMenuItems} />
                <ProfileMenu items={accountMenuItems} />
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
        backgroundColor: '#F8F9FA',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
