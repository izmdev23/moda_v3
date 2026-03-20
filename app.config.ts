import 'dotenv/config';
import { ConfigContext, ExpoConfig } from 'expo/config';
import { withAndroidManifest, withAndroidStyles } from 'expo/config-plugins';

const withMaterialTheme = (config: ExpoConfig) => {
    const withStyles = withAndroidStyles(config, async (config) => {
        const styles = config.modResults;
        const appTheme = styles.resources.style?.find(
            (style: any) => style.$.name === 'AppTheme'
        );
        if (appTheme) {
            appTheme.$.parent = 'Theme.MaterialComponents.DayNight.NoActionBar';
        }

        const splashTheme = styles.resources.style?.find(
            (style: any) => style.$.name === 'Theme.App.SplashScreen'
        );
        if (splashTheme) {
            const splashItems = Array.isArray(splashTheme.item)
                ? splashTheme.item
                : splashTheme.item
                    ? [splashTheme.item]
                    : [];

            const filteredItems = splashItems.filter(
                (item: any) => item?.$?.name !== 'android:windowSplashScreenBehavior'
            );

            const animatedIconItem = filteredItems.find(
                (item: any) => item?.$?.name === 'windowSplashScreenAnimatedIcon'
            );

            if (animatedIconItem) {
                animatedIconItem._ = '@android:color/transparent';
            } else {
                filteredItems.push({
                    $: { name: 'windowSplashScreenAnimatedIcon' },
                    _: '@android:color/transparent',
                });
            }

            splashTheme.item = filteredItems;
        }

        return config;
    });

    return withAndroidManifest(withStyles, (config) => {
        const application = config.modResults.manifest.application?.[0];
        if (application?.$) {
            application.$['android:icon'] = '@drawable/app_icon_dark';
            application.$['android:roundIcon'] = '@drawable/app_icon_dark';
        }
        return config;
    });
};

export default ({ config }: ConfigContext): ExpoConfig => {
    const customConfig: ExpoConfig = {
        ...config,
    name: 'Moda',
    slug: 'moda',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/app-icon-dark.png',
    scheme: 'moda',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
        supportsTablet: true
    },
    android: {
        package: 'com.velvet.moda',
        adaptiveIcon: {
            backgroundColor: '#000000',
            foregroundImage: './assets/images/app-icon-dark.png'
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
                image: './assets/images/app-icon-dark.png',
                imageWidth: 200,
                resizeMode: 'contain',
                backgroundColor: '#ffffff',
                dark: {
                    image: './assets/images/app-icon-dark.png',
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
    };
    return withMaterialTheme(customConfig);
};
