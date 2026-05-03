import { SafeScreen } from '@/components/ui/safe-screen';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@supabase/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../components/ui/theme-provider';
import { Animation } from '../utils/animation';

export default function Index(): React.ReactNode {
    const router = useRouter();
    const { theme } = useTheme();
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // If no session, go to auth/login. If session exists, go to home/catalog (buyer) or seller-dashboard (seller)
    useEffect(() => {
        if (!loading) {
            if (!session) {
                router.replace('/auth/login');
            } else {
                void checkRoleAndRedirect(session.user.id);
            }
        }
    }, [loading, session, router]);

    const checkRoleAndRedirect = async (authId: string): Promise<void> => {
        const { data: user } = await supabase
            .from('users')
            .select('role')
            .eq('auth_id', authId)
            .single();

        if (user?.role === 'seller') {
            router.replace('/home/seller-dashboard');
        } else {
            router.replace('/home/catalog');
        }
    };

    if (loading) {
        return (
            <SafeScreen>
                <Animated.View
                    entering={Animation.Presets.FadeInDown}
                    exiting={Animation.Presets.FadeOutDown}
                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.primary} />
                </Animated.View>
            </SafeScreen>
        );
    }

    return (
        <SafeScreen>
            <Animated.View
                entering={Animation.Presets.FadeInDown}
                exiting={Animation.Presets.FadeOutDown}
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.primary} />
            </Animated.View>
        </SafeScreen>
    );
}
