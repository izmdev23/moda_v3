import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DeliveryTimer, OrderStatus, OrderStatusBadge } from '../../components/my-orders-components';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';

export default function ProductDeliveryInfoScreen() {
    const { theme } = useTheme();
    const { orderId } = useLocalSearchParams();

    // Stub data
    const orderDetails = {
        title: 'Vintage Checkered Shirt',
        price: 450.00,
        origin: 'Retro Revival, Quezon City, Metro Manila',
        destination: 'Jose Rizal, 123 Mapagpala St, Barangay San Antonio, Pasig City, Metro Manila',
        status: 'shipped' as OrderStatus,
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 48), // 48h from now
    };

    return (
        <SafeScreen style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Header */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    <Text style={[styles.title, { color: theme.textPrimary }]}>{orderDetails.title}</Text>
                    <Text style={[styles.price, { color: theme.primary }]}>₱{orderDetails.price.toFixed(2)}</Text>
                    <View style={styles.statusRow}>
                        <OrderStatusBadge status={orderDetails.status} />
                        <DeliveryTimer status={orderDetails.status} deadline={orderDetails.deadline} />
                    </View>
                </View>

                {/* Tracking Flow */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Delivery Route</Text>

                    <View style={styles.routeItem}>
                        <MaterialIcons name="store" size={24} color={theme.textSecondary} />
                        <View style={styles.routeDetails}>
                            <Text style={[styles.routeLabel, { color: theme.textPrimary }]}>Origin (Seller)</Text>
                            <Text style={[styles.routeAddress, { color: theme.textSecondary }]}>{orderDetails.origin}</Text>
                        </View>
                    </View>

                    <View style={[styles.routeLine, { borderLeftColor: theme.border }]} />

                    <View style={styles.routeItem}>
                        <MaterialIcons name="home" size={24} color={theme.primary} />
                        <View style={styles.routeDetails}>
                            <Text style={[styles.routeLabel, { color: theme.primary }]}>Destination (You)</Text>
                            <Text style={[styles.routeAddress, { color: theme.textSecondary }]}>{orderDetails.destination}</Text>
                        </View>
                    </View>
                </View>

                {/* More Details (could include courier tracking) */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Tracking Information</Text>
                    <Text style={[styles.trackingText, { color: theme.textSecondary }]}>
                        Courier: J&T Express
                    </Text>
                    <Text style={[styles.trackingText, { color: theme.textSecondary }]}>
                        Tracking Number: {orderId || 'JT123456789PH'}
                    </Text>
                </View>

            </ScrollView>
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    section: {
        padding: 16,
        borderBottomWidth: 1,
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    price: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    routeItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    routeDetails: {
        flex: 1,
    },
    routeLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    routeAddress: {
        fontSize: 13,
        lineHeight: 18,
    },
    routeLine: {
        height: 40,
        borderLeftWidth: 2,
        marginLeft: 11,
        marginVertical: 4,
    },
    trackingText: {
        fontSize: 14,
        marginBottom: 8,
    }
});
