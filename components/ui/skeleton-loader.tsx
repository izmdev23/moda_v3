import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { lightPalette } from '../../utils/theme';

export interface SkeletonLoaderProps {
    readonly width?: number | string;
    readonly height?: number | string;
    readonly borderRadius?: number;
    readonly style?: StyleProp<ViewStyle>;
}

/**
 * Animated placeholder for content loading.
 * Uses the border color from the light palette as the skeleton base color.
 * @param props {SkeletonLoaderProps}
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 4,
    style,
}) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [animatedValue]);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                { width: width as any, height: height as any, borderRadius, opacity },
                style,
            ]}
        />
    );
};

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: lightPalette.border,
    },
});
