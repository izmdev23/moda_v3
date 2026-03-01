import { SafeScreen } from '@/components/ui/safe-screen';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@supabase/supabaseClient';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { Animation } from '../utils/animation';
import { lightPalette } from '../utils/theme';

export default function Index(): React.ReactNode {
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

    if (loading) {
        return (
            <SafeScreen>
                <Animated.View
                    entering={Animation.Presets.FadeInDown}
                    exiting={Animation.Presets.FadeOutUp}
                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={lightPalette.primary} />
                </Animated.View>
            </SafeScreen>
        );
    }

    // If no session, go to auth/login. If session exists, go to home/catalog (buyer) or shop-landing (seller)
    // For now, let's just go to the catalog if a session exists, else auth/login
    if (!session) {
        // Using relative path for auth/login
        return <Redirect href="/auth/login" />;
    }

    return <Redirect href="/home/catalog" />;
}
