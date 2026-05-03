import { SafeScreen } from '@/components/ui/safe-screen';
import { clearLocalSession, isInvalidRefreshTokenError } from '@/utils/auth-session';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@supabase/supabaseClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../components/ui/theme-provider';

export default function Index(): React.ReactNode {
    const router = useRouter();
    const { theme } = useTheme();
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session safely so auth refresh token errors do not crash startup
        const loadInitialSession = async (): Promise<void> => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error !== null) {
                    if (isInvalidRefreshTokenError(error)) {
                        await clearLocalSession();
                        setSession(null);
                        return;
                    }

                    console.warn('Initial session warning:', error.message);
                }
                setSession(session);
            } catch (error) {
                if (isInvalidRefreshTokenError(error)) {
                    await clearLocalSession();
                    setSession(null);
                    return;
                }

                const message = error instanceof Error ? error.message : 'Unknown session error';
                console.warn('Initial session failed:', message);
                setSession(null);
            } finally {
                setLoading(false);
            }
        };

        void loadInitialSession();

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
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('role')
                .eq('auth_id', authId)
                .single();

            if (error !== null) {
                router.replace('/home/catalog');
                return;
            }

            if (user?.role === 'seller') {
                router.replace('/home/seller-dashboard');
            } else {
                router.replace('/home/catalog');
            }
        } catch {
            router.replace('/home/catalog');
        }
    };

    if (loading) {
        return (
            <SafeScreen>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.primary} />
                </View>
            </SafeScreen>
        );
    }

    return (
        <SafeScreen>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.primary} />
            </View>
        </SafeScreen>
    );
}
