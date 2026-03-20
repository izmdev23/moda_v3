import React, { useEffect, useMemo, useState } from 'react';
import { Animated, ImageProps, ImageStyle, StyleProp, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme-provider';

const MAX_IMAGE_RETRY_ATTEMPTS = 3;
const IMAGE_RETRY_DELAY_MS = 700;

export interface ImageWithFallbackProps extends Omit<ImageProps, 'source'> {
    readonly uri?: string | null;
    readonly style?: StyleProp<ImageStyle>;
    readonly resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    readonly showProgressive?: boolean;
}

/**
 * Image component with skeleton loading placeholder, and error fallback state.
 * Prevents UI layout jumps for images fetching across the network.
 * Colors are sourced from the active theme via useTheme().
 * @param props {ImageWithFallbackProps}
 */
export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
    uri,
    style,
    resizeMode = 'cover',
    showProgressive = true,
    ...rest
}) => {
    const { theme } = useTheme();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [opacity] = useState(new Animated.Value(showProgressive ? 0 : 1));
    const [retryAttempt, setRetryAttempt] = useState<number>(0);

    useEffect((): void => {
        setStatus('loading');
        setRetryAttempt(0);
        opacity.setValue(showProgressive ? 0 : 1);
    }, [uri, showProgressive, opacity]);

    const resolvedUri = useMemo((): string => {
        if (!uri) return '';
        if (retryAttempt === 0) return uri;
        const joiner = uri.includes('?') ? '&' : '?';
        return `${uri}${joiner}retry=${retryAttempt}`;
    }, [uri, retryAttempt]);

    if (!uri) {
        return (
            <View style={[styles.placeholder, { backgroundColor: theme.border }, style]}>
                <Text style={[styles.errorText, { color: theme.gray }]}>No Image</Text>
            </View>
        );
    }

    const onLoad = (): void => {
        setStatus('success');
        if (showProgressive) {
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    };

    const onError = (): void => {
        if (retryAttempt < MAX_IMAGE_RETRY_ATTEMPTS) {
            setTimeout(() => {
                setStatus('loading');
                setRetryAttempt((current) => current + 1);
            }, IMAGE_RETRY_DELAY_MS);
            return;
        }
        setStatus('error');
    };

    return (
        <View style={style}>
            {status === 'loading' && (
                <View style={[StyleSheet.absoluteFill, styles.placeholder, { backgroundColor: theme.border }]}>
                    <Text style={[styles.loadingText, { color: theme.gray }]}>Loading...</Text>
                </View>
            )}

            {status === 'error' ? (
                <View style={[StyleSheet.absoluteFill, styles.placeholder, { backgroundColor: `${theme.error}10` }]}>
                    <Text style={[styles.errorText, { color: theme.error }]}>Image Failed</Text>
                </View>
            ) : (
                <Animated.Image
                    source={{ uri: resolvedUri }}
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 10,
    },
    errorText: {
        fontSize: 10,
    }
});
