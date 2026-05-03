import { DotLottie } from '@lottiefiles/dotlottie-react-native';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type DotLottieSource = number | string | { readonly uri: string };

export interface AnimatedActivityLoaderProps {
    readonly src: DotLottieSource;
    readonly size?: number;
    readonly style?: StyleProp<ViewStyle>;
    readonly loop?: boolean;
    readonly autoplay?: boolean;
    readonly accessibilityLabel?: string;
}

/**
 * Reusable animated loader based on dotLottie assets.
 * Accepts local require(...) sources or URI/string paths via the `src` prop.
 */
export const AnimatedActivityLoader: React.FC<AnimatedActivityLoaderProps> = ({
    src,
    size = 180,
    style,
    loop = true,
    autoplay = true,
    accessibilityLabel = 'Loading animation',
}): React.JSX.Element => {
    return (
        <View
            style={[styles.container, style]}
            accessible
            accessibilityLabel={accessibilityLabel}
        >
            <DotLottie
                source={src}
                style={{ width: size, height: size }}
                loop={loop}
                autoplay={autoplay}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
