import 'dotenv/config';
import { ConfigContext, ExpoConfig } from 'expo/config';
import { withAndroidManifest, withAndroidStyles } from 'expo/config-plugins';

interface AndroidStyleItem {
    readonly $?: {
        readonly name?: string;
    };
    _?: string;
}

interface AndroidStyleEntry {
    readonly $: {
        readonly name: string;
        parent?: string;
    };
    item?: AndroidStyleItem | AndroidStyleItem[];
}

const APP_BRAND_ICON = './assets/images/adaptive-icon.png';

const withMaterialTheme = (config: ExpoConfig): ExpoConfig => {
    const withStyles = withAndroidStyles(config, async (config) => {
        const styles = config.modResults;
        const styleEntries = (styles.resources.style ?? []) as AndroidStyleEntry[];

        const appTheme = styleEntries.find(
            (style) => style.$.name === 'AppTheme'
        );
        if (appTheme) {
            appTheme.$.parent = 'Theme.MaterialComponents.DayNight.NoActionBar';
        }

        const splashTheme = styleEntries.find(
            (style) => style.$.name === 'Theme.App.SplashScreen'
        );
        if (splashTheme) {
            const splashItems: AndroidStyleItem[] = Array.isArray(splashTheme.item)
                ? splashTheme.item
                : splashTheme.item
                    ? [splashTheme.item]
                    : [];

            const filteredItems = splashItems.filter(
                (item) => item.$?.name !== 'android:windowSplashScreenBehavior'
            );

            const animatedIconItem = filteredItems.find(
                (item) => item.$?.name === 'windowSplashScreenAnimatedIcon'
            );

            if (animatedIconItem) {
                animatedIconItem._ = '@drawable/splashscreen_logo';
            } else {
                filteredItems.push({
                    $: { name: 'windowSplashScreenAnimatedIcon' },
                    _: '@drawable/splashscreen_logo',
                });
            }

            splashTheme.item = filteredItems;
        }

        return config;
    });

    return withAndroidManifest(withStyles, (config) => {
        const application = config.modResults.manifest.application?.[0];
        if (application?.$) {
            application.$['android:icon'] = '@mipmap/ic_launcher';
            application.$['android:roundIcon'] = '@mipmap/ic_launcher_round';
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
    icon: APP_BRAND_ICON,
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
            foregroundImage: APP_BRAND_ICON
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
                image: APP_BRAND_ICON,
                imageWidth: 200,
                resizeMode: 'contain',
                backgroundColor: '#ffffff',
                dark: {
                    image: APP_BRAND_ICON,
                    backgroundColor: '#000000'
                }
            }
        ],
        'expo-secure-store',
        'expo-notifications',
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
