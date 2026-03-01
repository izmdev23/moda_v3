import 'dotenv/config';
import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: 'Moda',
    slug: 'moda',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'moda',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
        supportsTablet: true
    },
    android: {
        package: 'com.velvet.moda',
        adaptiveIcon: {
            backgroundColor: '#E6F4FE',
            foregroundImage: './assets/images/android-icon-foreground.png',
            backgroundImage: './assets/images/android-icon-background.png',
            monochromeImage: './assets/images/android-icon-monochrome.png'
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false
    },
    web: {
        output: 'static',
        favicon: './assets/images/favicon.png'
    },
    plugins: [
        'expo-router',
        [
            'expo-splash-screen',
            {
                image: './assets/images/splash-icon.png',
                imageWidth: 200,
                resizeMode: 'contain',
                backgroundColor: '#ffffff',
                dark: {
                    backgroundColor: '#000000'
                }
            }
        ],
        'expo-secure-store',
        [
            'expo-build-properties',
            {
                android: {
                    minSdkVersion: 27
                }
            }
        ]
    ],
    experiments: {
        typedRoutes: true,
        reactCompiler: false
    },
    extra: {
        supabaseUrl: process.env.SUPABASE_URL,
        supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
        replicateApiKey: process.env.REPLICATE_API_KEY,
        geminiApiKey: process.env.GEMINI_API_KEY,
        xenditKey: process.env.XENDIT_KEY,
        secureStorageKey: process.env.SECURE_STORAGE_KEY,
    }
});
