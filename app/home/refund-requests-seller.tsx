import { RipplePressable } from '@/components/ui/ripple-pressable';
import { AppAlert } from '@/utils/app-alert';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { EmptyList } from '../../components/ui/empty-list';
import { LoadingModal } from '../../components/ui/loading-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import { SellerRefundRequestItem, useProcessRefundDecision, useSellerRefundRequests } from '../../hooks/use-refunds';
import { formatPrice } from '../../utils/utils';

interface PendingDecisionState {
    readonly refundUid: string;
    readonly decision: 'accepted' | 'rejected';
}

function getStatusColors(status: SellerRefundRequestItem['status'], theme: ReturnType<typeof useTheme>['theme']): { readonly backgroundColor: string; readonly textColor: string } {
    if (status === 'accepted') {
        return {
            backgroundColor: `${theme.success}20`,
            textColor: theme.success,
        };
    }

    if (status === 'rejected') {
        return {
            backgroundColor: `${theme.error}20`,
            textColor: theme.error,
        };
    }

    return {
        backgroundColor: `${theme.warning}20`,
        textColor: theme.warning,
    };
}

export default function RefundRequestsSellerScreen(): React.JSX.Element {
    const { theme } = useTheme();
    const { data: currentUser } = useCurrentUser();
    const sellerUserId = currentUser?.id ?? null;
    const {
        data: refundRequests = [],
        isLoading,
        isRefetching,
        refetch,
    } = useSellerRefundRequests(sellerUserId);
    const processRefundDecisionMutation = useProcessRefundDecision();

    const [responseByRefundUid, setResponseByRefundUid] = useState<Record<string, string>>({});
    const [pendingDecision, setPendingDecision] = useState<PendingDecisionState | null>(null);

    useFocusEffect(
        useCallback((): void => {
            if (sellerUserId === null) {
                return;
            }

            void refetch();
        }, [sellerUserId, refetch]),
    );

    const pendingCount = useMemo(() => refundRequests.filter((request) => request.status === 'pending').length, [refundRequests]);

    const handleRequestDecision = useCallback((refundUid: string, decision: 'accepted' | 'rejected'): void => {
        setPendingDecision({ refundUid, decision });
    }, []);

    const submitDecision = useCallback(async (): Promise<void> => {
        if (pendingDecision === null) {
            return;
        }

        const sellerResponse = responseByRefundUid[pendingDecision.refundUid]?.trim() ?? '';

        try {
            await processRefundDecisionMutation.mutateAsync({
                refundUid: pendingDecision.refundUid,
                decision: pendingDecision.decision,
                sellerResponse,
            });

            AppAlert.alert(
                pendingDecision.decision === 'accepted' ? 'Refund Approved' : 'Refund Rejected',
                pendingDecision.decision === 'accepted'
                    ? 'The buyer has been credited successfully.'
                    : 'The buyer has been notified about the rejection.',
            );

            setPendingDecision(null);
            void refetch();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to process refund request.';
            AppAlert.alert('Error', message);
        }
    }, [pendingDecision, processRefundDecisionMutation, refetch, responseByRefundUid]);

    const renderRefundRequest = ({ item }: { item: SellerRefundRequestItem }): React.JSX.Element => {
        const statusColors = getStatusColors(item.status, theme);

        return (
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.buyerMetaWrap}>
                        <View style={[styles.buyerAvatarFallback, { backgroundColor: theme.background }]}> 
                            {item.buyerAvatarUrl !== null && item.buyerAvatarUrl.trim().length > 0 ? (
                                <Image source={{ uri: item.buyerAvatarUrl }} style={styles.buyerAvatarImage} contentFit="cover" />
                            ) : (
                                <MaterialIcons name="person" size={18} color={theme.textSecondary} />
                            )}
                        </View>
                        <View>
                            <Text style={[styles.buyerName, { color: theme.textPrimary }]}>{item.buyerName}</Text>
                            <Text style={[styles.requestDate, { color: theme.textSecondary }]}>{new Date(item.createdAt).toLocaleString()}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: statusColors.backgroundColor }]}> 
                        <Text style={[styles.statusChipText, { color: statusColors.textColor }]}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>

                <Text style={[styles.productName, { color: theme.textPrimary }]}>{item.productName}</Text>
                <Text style={[styles.variantName, { color: theme.textSecondary }]}>{item.variantName}</Text>
                <Text style={[styles.refundAmount, { color: theme.primary }]}>{formatPrice(item.refundAmount)}</Text>

                <View style={[styles.reasonBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
                    <Text style={[styles.reasonLabel, { color: theme.textSecondary }]}>Buyer Message</Text>
                    <Text style={[styles.reasonValue, { color: theme.textPrimary }]}>{item.reason}</Text>
                </View>

                {item.evidenceImageUrls.length > 0 && (
                    <FlatList
                        horizontal
                        data={item.evidenceImageUrls}
                        keyExtractor={(imageUrl) => imageUrl}
                        style={styles.imagesList}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.imagesListContent}
                        renderItem={({ item: imageUrl }) => (
                            <Image source={{ uri: imageUrl }} style={styles.evidenceImage} contentFit="cover" />
                        )}
                    />
                )}

                {item.status === 'pending' && (
                    <>
                        <TextInput
                            value={responseByRefundUid[item.uid] ?? ''}
                            onChangeText={(nextValue) => {
                                setResponseByRefundUid((previousState) => ({
                                    ...previousState,
                                    [item.uid]: nextValue,
                                }));
                            }}
                            placeholder="Optional response to buyer"
                            placeholderTextColor={theme.textSecondary}
                            style={[
                                styles.responseInput,
                                {
                                    color: theme.textPrimary,
                                    borderColor: theme.border,
                                    backgroundColor: theme.background,
                                },
                            ]}
                        />

                        <View style={styles.actionRow}>
                            <RipplePressable
                                style={[styles.actionButton, { backgroundColor: `${theme.error}20`, borderColor: theme.error }]}
                                onPress={() => handleRequestDecision(item.uid, 'rejected')}
                            >
                                <Text style={[styles.rejectText, { color: theme.error }]}>Reject</Text>
                            </RipplePressable>

                            <RipplePressable
                                style={[styles.actionButton, { backgroundColor: theme.success, borderColor: theme.success }]}
                                onPress={() => handleRequestDecision(item.uid, 'accepted')}
                            >
                                <Text style={[styles.acceptText, { color: theme.white }]}>Accept Refund</Text>
                            </RipplePressable>
                        </View>
                    </>
                )}

                {item.status !== 'pending' && item.sellerResponse !== null && item.sellerResponse.trim().length > 0 && (
                    <View style={[styles.responseBox, { borderColor: theme.border }]}> 
                        <Text style={[styles.responseLabel, { color: theme.textSecondary }]}>Your Response</Text>
                        <Text style={[styles.responseValue, { color: theme.textPrimary }]}>{item.sellerResponse}</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeScreen style={styles.container}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
                <RipplePressable style={styles.backButton} onPress={() => router.back()}>
                    <MaterialIcons name="arrow-back" size={20} color={theme.primary} />
                </RipplePressable>
                <View style={styles.headerTextWrap}>
                    <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Refund Requests</Text>
                    <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{pendingCount} pending request(s)</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <FlatList
                data={refundRequests}
                keyExtractor={(item) => item.uid}
                renderItem={renderRefundRequest}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={() => { void refetch(); }}
                        tintColor={theme.primary}
                    />
                }
                ListEmptyComponent={
                    isLoading
                        ? <View style={styles.emptyPlaceholder} />
                        : (
                            <EmptyList
                                icon={<MaterialIcons name="assignment-return" size={48} color={theme.textSecondary} />}
                                message="No refund requests"
                                submessage="New buyer refund requests will appear here."
                            />
                        )
                }
            />

            {pendingDecision !== null && (
                <View style={styles.confirmOverlay}>
                    <View style={[styles.confirmCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                        <Text style={[styles.confirmTitle, { color: theme.textPrimary }]}>Confirm Decision</Text>
                        <Text style={[styles.confirmMessage, { color: theme.textSecondary }]}>
                            {pendingDecision.decision === 'accepted'
                                ? 'Approve this refund request and credit the buyer?'
                                : 'Reject this refund request?'}
                        </Text>
                        <View style={styles.confirmActions}>
                            <RipplePressable
                                style={[styles.confirmButton, { borderColor: theme.border, backgroundColor: theme.background }]}
                                onPress={() => setPendingDecision(null)}
                            >
                                <Text style={[styles.confirmButtonText, { color: theme.textPrimary }]}>Cancel</Text>
                            </RipplePressable>
                            <RipplePressable
                                style={[styles.confirmButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                onPress={() => { void submitDecision(); }}
                            >
                                <Text style={[styles.confirmButtonText, { color: theme.white }]}>Confirm</Text>
                            </RipplePressable>
                        </View>
                    </View>
                </View>
            )}

            <LoadingModal isVisible={processRefundDecisionMutation.isPending} message="Processing refund decision..." />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        borderBottomWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        padding: 6,
    },
    headerTextWrap: {
        flex: 1,
        marginLeft: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: 12,
    },
    headerSpacer: {
        width: 28,
    },
    listContent: {
        padding: 14,
        paddingBottom: 24,
    },
    emptyPlaceholder: {
        height: 10,
    },
    card: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    buyerMetaWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    buyerAvatarFallback: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginRight: 10,
    },
    buyerAvatarImage: {
        width: 34,
        height: 34,
    },
    buyerName: {
        fontSize: 13,
        fontWeight: '700',
    },
    requestDate: {
        fontSize: 11,
        marginTop: 2,
    },
    statusChip: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    statusChipText: {
        fontSize: 10,
        fontWeight: '700',
    },
    productName: {
        marginTop: 10,
        fontSize: 15,
        fontWeight: '600',
    },
    variantName: {
        marginTop: 4,
        fontSize: 12,
    },
    refundAmount: {
        marginTop: 6,
        fontSize: 16,
        fontWeight: '700',
    },
    reasonBox: {
        marginTop: 10,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
    },
    reasonLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    reasonValue: {
        fontSize: 13,
        lineHeight: 18,
    },
    imagesList: {
        marginTop: 10,
    },
    imagesListContent: {
        paddingRight: 8,
    },
    evidenceImage: {
        width: 88,
        height: 88,
        borderRadius: 8,
        marginRight: 8,
    },
    responseInput: {
        borderWidth: 1,
        borderRadius: 8,
        marginTop: 12,
        minHeight: 44,
        paddingHorizontal: 10,
        paddingVertical: 10,
        fontSize: 13,
    },
    actionRow: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    actionButton: {
        flex: 1,
        borderRadius: 8,
        borderWidth: 1,
        paddingVertical: 11,
        alignItems: 'center',
    },
    rejectText: {
        fontSize: 13,
        fontWeight: '700',
    },
    acceptText: {
        fontSize: 13,
        fontWeight: '700',
    },
    responseBox: {
        marginTop: 10,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
    },
    responseLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 5,
        textTransform: 'uppercase',
    },
    responseValue: {
        fontSize: 13,
        lineHeight: 18,
    },
    confirmOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    confirmCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
    },
    confirmTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    confirmMessage: {
        fontSize: 13,
        marginTop: 8,
        lineHeight: 19,
    },
    confirmActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 14,
    },
    confirmButton: {
        minWidth: 92,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    confirmButtonText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
