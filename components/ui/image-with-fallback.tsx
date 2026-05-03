import { ImageProps as ExpoImageProps, Image, ImageContentFit } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { ImageStyle, StyleProp, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme-provider';

const MAX_IMAGE_RETRY_ATTEMPTS = 3;
const IMAGE_RETRY_DELAY_MS = 700;
const IMAGE_TRANSITION_MS = 220;

type SupportedResizeMode = 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';

export interface ImageWithFallbackProps extends Omit<ExpoImageProps, 'source' | 'contentFit' | 'style'> {
    readonly uri?: string | null;
    readonly src?: string | null;
    readonly style?: StyleProp<ImageStyle>;
    readonly resizeMode?: SupportedResizeMode;
    readonly showProgressive?: boolean;
}

function mapResizeModeToContentFit(resizeMode: SupportedResizeMode): ImageContentFit {
    if (resizeMode === 'contain' || resizeMode === 'center') return 'contain';
    if (resizeMode === 'stretch') return 'fill';
    return 'cover';
}

/**
 * Image component with skeleton loading placeholder, and error fallback state.
 * Prevents UI layout jumps for images fetching across the network.
 * Colors are sourced from the active theme via useTheme().
 * @param props {ImageWithFallbackProps}
 */
export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
    uri,
    src,
    style,
    resizeMode = 'cover',
    showProgressive = true,
    ...rest
}) => {
    const { theme } = useTheme();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [retryAttempt, setRetryAttempt] = useState<number>(0);
    const resolvedSourceUri = uri ?? src ?? '';

    useEffect((): void => {
        setStatus('loading');
        setRetryAttempt(0);
    }, [resolvedSourceUri, showProgressive]);

    const resolvedUri = useMemo((): string => {
        if (!resolvedSourceUri) return '';
        if (retryAttempt === 0) return resolvedSourceUri;
        const joiner = resolvedSourceUri.includes('?') ? '&' : '?';
        return `${resolvedSourceUri}${joiner}retry=${retryAttempt}`;
    }, [resolvedSourceUri, retryAttempt]);

    if (!resolvedSourceUri) {
        return (
            <View style={[styles.placeholder, { backgroundColor: theme.border }, style]}>
                <Text style={[styles.errorText, { color: theme.gray }]}>No Image</Text>
            </View>
        );
    }

    const onLoad = (): void => {
        setStatus('success');
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
                <Image
                    source={{ uri: resolvedUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit={mapResizeModeToContentFit(resizeMode)}
                    transition={showProgressive ? IMAGE_TRANSITION_MS : 0}
                    cachePolicy="memory-disk"
                    onLoad={onLoad}
                    onError={onError}
                    recyclingKey={resolvedUri}
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
