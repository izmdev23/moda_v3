import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

/**
 * Banner to show when device is offline. Auto-hides when reconnected.
 */
export const NetworkErrorBanner: React.FC = () => {
    const [isConnected, setIsConnected] = useState<boolean | null>(true);
    const [translateY] = useState(new Animated.Value(-50)); // Start hidden off-screen

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const connected = state.isConnected;
            setIsConnected(connected);

            if (connected === false) {
                // Show banner
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            } else if (connected === true) {
                // Hide banner
                setTimeout(() => {
                    Animated.timing(translateY, {
                        toValue: -50,
                        duration: 300,
                        useNativeDriver: true,
                    }).start();
                }, 2000); // give user a chance to read the 'back online' state
            }
        });

        return () => {
            unsubscribe();
        };
    }, [translateY]);

    if (isConnected === null) return null; // Still checking

    // Don't render anything initially if connected
    return (
        <Animated.View style={[
            styles.container,
            { transform: [{ translateY }] },
            isConnected === true ? styles.onlineContainer : styles.offlineContainer
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
        paddingTop: 45, // Account for safe area roughly
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    offlineContainer: {
        backgroundColor: '#FF3B30', // Danger/Offline
    },
    onlineContainer: {
        backgroundColor: '#2DCE89', // Success/Online
    },
    text: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
