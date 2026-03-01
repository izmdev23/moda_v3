import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';
import { getSecureItem, removeSecureItem, setSecureItem } from '../utils/secureStorage';
import { Database } from './database.types';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
const supabasePublishableKey = Constants.expoConfig?.extra?.supabasePublishableKey as string;

// SecureStore storage adapter for Supabase persistence
// Uses the robust chunked implementation to handle large session tokens > 2048 bytes
const ExpoSecureStoreAdapter = {
    getItem: (key: string): string | Promise<string | null> | null => {
        return getSecureItem(key);
    },
    setItem: (key: string, value: string): Promise<void> => {
        return setSecureItem(key, value).then(() => { });
    },
    removeItem: (key: string): Promise<void> => {
        return removeSecureItem(key).then(() => { });
    },
};

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
        storage: ExpoSecureStoreAdapter as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
