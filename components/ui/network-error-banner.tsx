import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { lightPalette } from '../../utils/theme';

/**
 * Banner to show when device is offline. Auto-hides when reconnected.
 * Uses static palette values since it renders outside of normal component hierarchy
 * (above SafeScreen) and must always be visible regardless of theme.
 */
export const NetworkErrorBanner: React.FC = () => {
    const [isConnected, setIsConnected] = useState<boolean | null>(true);
    const [translateY] = useState(new Animated.Value(-50));

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const connected = state.isConnected;
            setIsConnected(connected);

            if (connected === false) {
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            } else if (connected === true) {
                setTimeout(() => {
                    Animated.timing(translateY, {
                        toValue: -50,
                        duration: 300,
                        useNativeDriver: true,
                    }).start();
                }, 2000);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [translateY]);

    if (isConnected === null) return null;

    return (
        <Animated.View style={[
            styles.container,
            { transform: [{ translateY }] },
            isConnected === true
                ? { backgroundColor: lightPalette.success }
                : { backgroundColor: lightPalette.error }
        ]}>
            <Text style={styles.text}>
                {isConnected ? 'Back Online' : 'No Internet Connection'}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: 10,
        paddingTop: 45,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    text: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
