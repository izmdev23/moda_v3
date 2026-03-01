import React, { useState } from 'react';
import { Animated, ImageProps, ImageStyle, StyleProp, StyleSheet, Text, View } from 'react-native';

export interface ImageWithFallbackProps extends Omit<ImageProps, 'source'> {
    readonly uri?: string | null;
    readonly style?: StyleProp<ImageStyle>;
    readonly resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    readonly showProgressive?: boolean;
}

/**
 * Image component with skeleton loading placeholder, and error fallback state.
 * Prevents UI layout jumps for images fetching across network.
 * @param props {ImageWithFallbackProps}
 */
export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
    uri,
    style,
    resizeMode = 'cover',
    showProgressive = true,
    ...rest
}) => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [opacity] = useState(new Animated.Value(showProgressive ? 0 : 1));

    if (!uri) {
        return (
            <View style={[styles.placeholder, style]}>
                <Text style={styles.errorText}>No Image</Text>
            </View>
        );
    }

    const onLoad = () => {
        setStatus('success');
        if (showProgressive) {
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    };

    const onError = () => {
        setStatus('error');
    };

    return (
        <View style={style}>
            {status === 'loading' && (
                <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            )}

            {status === 'error' ? (
                <View style={[StyleSheet.absoluteFill, styles.placeholderError]}>
                    <Text style={styles.errorText}>Image Failed</Text>
                </View>
            ) : (
                <Animated.Image
                    source={{ uri }}
                    style={[StyleSheet.absoluteFill, { opacity }]}
                    resizeMode={resizeMode}
                    onLoad={onLoad}
                    onError={onError}
                    {...rest}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    placeholder: {
        backgroundColor: '#E1E9EE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderError: {
        backgroundColor: '#FFF5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#A0A0A0',
        fontSize: 10,
    },
    errorText: {
        color: '#FF3B30', // Danger
        fontSize: 10,
    }
});
