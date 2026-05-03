import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import {
    ShopBanner,
    ShopTabType,
    ShopTabs,
    StoreProductsGrid,
    TaggedProductsList,
} from '../../components/shop-landing-components';
import { EmptyList } from '../../components/ui/empty-list';
import { LoadingIndicator } from '../../components/ui/loading-indicator';
import { ModaAlertModal } from '../../components/ui/moda-alert-modal';
import { SafeScreen } from '../../components/ui/safe-screen';
import { useTheme } from '../../components/ui/theme-provider';
import { useCurrentUser } from '../../hooks/use-current-user';
import type { MyStoreProduct } from '../../hooks/use-my-store';
import { useMyStoreData } from '../../hooks/use-my-store';
import { supabase } from '../../supabase/supabaseClient';

const SHOP_LANDING_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];
const SHOP_COVER_BUCKET = 'product-images';
const DEFAULT_STORE_DESCRIPTION = 'No shop description yet.';
const SUPPORTED_IMAGE_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const LOCAL_URI_READ_TIMEOUT_MS = 30000;

interface AlertState {
    readonly visible: boolean;
    readonly title: string;
    readonly message: string;
    readonly positiveLabel: string;
}

const HIDDEN_ALERT_STATE: AlertState = {
    visible: false,
    title: '',
    message: '',
    positiveLabel: 'OK',
};

function inferMimeTypeFromUri(uri: string): string {
    const normalizedUri = uri.toLowerCase();

    if (normalizedUri.endsWith('.png')) return 'image/png';
    if (normalizedUri.endsWith('.webp')) return 'image/webp';

    return 'image/jpeg';
}

function resolveImageExtension(mimeType: string): string {
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';

    return 'jpg';
}

function isBlob(value: unknown): value is Blob {
    return typeof value === 'object' && value !== null && typeof (value as { readonly size?: unknown }).size === 'number';
}

function readLocalUriAsBlob(uri: string): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.onerror = (): void => {
            reject(new Error('Unable to read selected image.'));
        };

        request.ontimeout = (): void => {
            reject(new Error('Reading selected image timed out.'));
        };

        request.onload = (): void => {
            if (isBlob(request.response)) {
                resolve(request.response);
                return;
            }

            reject(new Error('Invalid image data.'));
        };

        request.responseType = 'blob';
        request.timeout = LOCAL_URI_READ_TIMEOUT_MS;
        request.open('GET', uri, true);
        request.send();
    });
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = (): void => {
            reject(reader.error ?? new Error('Failed to process selected image.'));
        };

        reader.onload = (): void => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);
                return;
            }

            reject(new Error('Failed to process selected image.'));
        };

        reader.readAsArrayBuffer(blob);
    });
}

async function readLocalUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
    try {
        const blob = await readLocalUriAsBlob(uri);
        return await blobToArrayBuffer(blob);
    } catch {
        const response = await fetch(uri);

        if (!response.ok) {
            throw new Error('Unable to read selected image.');
        }

        return await response.arrayBuffer();
    }
}

function normalizeStoreDescription(description: string): string {
    const trimmedDescription = description.trim();

    return trimmedDescription === DEFAULT_STORE_DESCRIPTION ? '' : trimmedDescription;
}

function decodeHtmlEntities(content: string): string {
    return content
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
}

function extractPlainTextFromHtml(content: string): string {
    const withLineBreaks = content
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ');

    const withoutTags = withLineBreaks.replace(/<[^>]*>/g, ' ');
    const decoded = decodeHtmlEntities(withoutTags);

    return decoded
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function isRichTextEffectivelyEmpty(content: string): boolean {
    const normalizedContent = content.replace(/\u200B/g, '');
    const plainText = extractPlainTextFromHtml(normalizedContent);

    return plainText.length === 0;
}

function normalizeShopUid(uidParam: string | string[] | undefined): string | null {
    if (uidParam === undefined) return null;

    const rawUid = Array.isArray(uidParam) ? uidParam[0] : uidParam;
    const normalizedUid = rawUid.trim();

    return normalizedUid.length > 0 ? normalizedUid : null;
}

function sortBySoldCountDescending(products: readonly MyStoreProduct[]): MyStoreProduct[] {
    const sortedProducts = [...products];

    sortedProducts.sort((a, b) => {
        if (b.totalSales === a.totalSales) {
            return a.name.localeCompare(b.name);
        }

        return b.totalSales - a.totalSales;
    });

    return sortedProducts;
}

export default function ShopLandingScreen(): React.JSX.Element {
    const { uid } = useLocalSearchParams<{ uid?: string | string[] }>();
    const { theme } = useTheme();

    const shopUid = useMemo<string | null>(() => normalizeShopUid(uid), [uid]);

    const [activeTab, setActiveTab] = useState<ShopTabType>('All');
    const [isFollowing, setIsFollowing] = useState<boolean>(false);
    const [storeTitleDraft, setStoreTitleDraft] = useState<string>('');
    const [storeDescriptionDraft, setStoreDescriptionDraft] = useState<string>('');
    const [isEditingStoreTitle, setIsEditingStoreTitle] = useState<boolean>(false);
    const [isEditingStoreDescription, setIsEditingStoreDescription] = useState<boolean>(false);
    const [isDescriptionSaving, setIsDescriptionSaving] = useState<boolean>(false);
    const [isStoreActionLoading, setIsStoreActionLoading] = useState<boolean>(false);
    const [storeActionMessage, setStoreActionMessage] = useState<string>('Updating store...');
    const [alertState, setAlertState] = useState<AlertState>(HIDDEN_ALERT_STATE);
    const [isTabContentReady, setIsTabContentReady] = useState<boolean>(false);

    const { data: currentUser } = useCurrentUser();
    const {
        data: myStoreData,
        isLoading,
        isFetching,
        isError,
        refetch,
    } = useMyStoreData(shopUid);

    const isOwner =
        myStoreData !== null &&
        myStoreData !== undefined &&
        currentUser !== null &&
        currentUser !== undefined &&
        myStoreData.shop.ownerUserId === currentUser.id;

    const bestSellerProducts = useMemo<MyStoreProduct[]>(() => {
        if (myStoreData === null || myStoreData === undefined) {
            return [];
        }

        return sortBySoldCountDescending(myStoreData.products);
    }, [myStoreData]);

    useEffect(() => {
        if (myStoreData === null || myStoreData === undefined) return;

        if (!isEditingStoreTitle) {
            setStoreTitleDraft(myStoreData.shop.shopName);
        }

        if (!isEditingStoreDescription) {
            setStoreDescriptionDraft(normalizeStoreDescription(myStoreData.shop.description));
        }
    }, [isEditingStoreDescription, isEditingStoreTitle, myStoreData]);

    useEffect(() => {
        setIsTabContentReady(false);

        const interactionTask = InteractionManager.runAfterInteractions(() => {
            setIsTabContentReady(true);
        });

        return (): void => {
            interactionTask.cancel();
        };
    }, [activeTab, shopUid]);

    const sellerViewParam = isOwner ? 'true' : 'false';

    const showModaAlert = (title: string, message: string, positiveLabel: string = 'OK'): void => {
        setAlertState({
            visible: true,
            title,
            message,
            positiveLabel,
        });
    };

    const hideModaAlert = (): void => {
        setAlertState(HIDDEN_ALERT_STATE);
    };

    const handleFollowToggle = (): void => {
        setIsFollowing((previousState) => !previousState);
    };

    const handleChatPress = (): void => {
        router.push('/home/chat-thread');
    };

    const handleProductPress = (productUid: string): void => {
        router.push({
            pathname: '/home/product-details' as const,
            params: {
                uid: productUid,
                sellerView: sellerViewParam,
            },
        } as Parameters<typeof router.push>[0]);
    };

    const handleTagPress = (tagKey: string, tagLabel: string): void => {
        if (shopUid === null) return;

        router.push({
            pathname: '/home/shop-tag-products' as const,
            params: {
                uid: shopUid,
                tag: tagKey,
                label: tagLabel,
            },
        } as Parameters<typeof router.push>[0]);
    };

    const handleStartStoreTitleEdit = (): void => {
        if (!isOwner || shopUid === null || isStoreActionLoading || isDescriptionSaving) return;

        setStoreTitleDraft(myStoreData?.shop.shopName ?? '');
        setIsEditingStoreTitle(true);
    };

    const handleCancelStoreTitleEdit = (): void => {
        setStoreTitleDraft(myStoreData?.shop.shopName ?? '');
        setIsEditingStoreTitle(false);
    };

    const handleSaveStoreTitle = async (): Promise<void> => {
        if (!isOwner || shopUid === null || isStoreActionLoading || isDescriptionSaving) return;

        const normalizedTitle = storeTitleDraft.trim();
        if (normalizedTitle.length === 0) {
            showModaAlert('Invalid title', 'Store title cannot be empty.');
            return;
        }

        const currentTitle = (myStoreData?.shop.shopName ?? '').trim();
        if (normalizedTitle === currentTitle) {
            setIsEditingStoreTitle(false);
            return;
        }

        try {
            setStoreActionMessage('Saving store title...');
            setIsStoreActionLoading(true);

            const { error } = await supabase
                .from('shops')
                .update({ shop_name: normalizedTitle })
                .eq('uid', shopUid);

            if (error) {
                throw new Error(error.message);
            }

            await refetch();
            setIsEditingStoreTitle(false);
            showModaAlert('Success', 'Store title updated.');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update store title.';
            showModaAlert('Update failed', message);
        } finally {
            setIsStoreActionLoading(false);
        }
    };

    const handleStartStoreDescriptionEdit = (): void => {
        if (!isOwner || shopUid === null || isStoreActionLoading || isDescriptionSaving) return;

        setStoreDescriptionDraft(normalizeStoreDescription(myStoreData?.shop.description ?? ''));
        setIsEditingStoreDescription(true);
    };

    const handleCancelStoreDescriptionEdit = (): void => {
        setStoreDescriptionDraft(normalizeStoreDescription(myStoreData?.shop.description ?? ''));
        setIsEditingStoreDescription(false);
    };

    const handleSaveStoreDescription = async (): Promise<void> => {
        if (!isOwner || shopUid === null || isStoreActionLoading || isDescriptionSaving) return;

        const normalizedDescription = storeDescriptionDraft.trim();
        const shouldClearDescription = isRichTextEffectivelyEmpty(normalizedDescription);
        const nextDescriptionValue = shouldClearDescription ? null : normalizedDescription;
        const currentDescriptionValue = normalizeStoreDescription(myStoreData?.shop.description ?? '');

        if ((nextDescriptionValue ?? '') === currentDescriptionValue) {
            setIsEditingStoreDescription(false);
            return;
        }

        try {
            setIsDescriptionSaving(true);

            const { error } = await supabase
                .from('shops')
                .update({ description: nextDescriptionValue })
                .eq('uid', shopUid);

            if (error) {
                throw new Error(error.message);
            }

            await refetch();
            setIsEditingStoreDescription(false);
            showModaAlert('Success', 'Store description updated.');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update store description.';
            showModaAlert('Update failed', message);
        } finally {
            setIsDescriptionSaving(false);
        }
    };

    const handleChangeStoreCover = async (): Promise<void> => {
        if (!isOwner || shopUid === null) return;

        try {
            const pickerResult = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.9,
            });

            if (pickerResult.canceled || pickerResult.assets.length === 0) {
                return;
            }

            const selectedAsset = pickerResult.assets[0];
            const selectedMimeType = selectedAsset.mimeType ?? inferMimeTypeFromUri(selectedAsset.uri);

            if (!SUPPORTED_IMAGE_MIME_TYPES.includes(selectedMimeType)) {
                showModaAlert('Invalid image', 'Please select a JPG, PNG, or WEBP image.');
                return;
            }

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                throw new Error(sessionError.message);
            }

            const authUserId = sessionData.session?.user?.id;
            if (!authUserId) {
                throw new Error('You must be logged in to update your cover photo.');
            }

            setStoreActionMessage('Uploading store cover...');
            setIsStoreActionLoading(true);

            const imageExtension = resolveImageExtension(selectedMimeType);
            const storagePath = `${authUserId}/shop-cover-${Date.now()}.${imageExtension}`;

            const imageArrayBuffer = await readLocalUriAsArrayBuffer(selectedAsset.uri);

            const { error: uploadError } = await supabase
                .storage
                .from(SHOP_COVER_BUCKET)
                .upload(storagePath, imageArrayBuffer, {
                    contentType: selectedMimeType,
                    upsert: true,
                });

            if (uploadError) {
                throw new Error(uploadError.message);
            }

            const { data: publicUrlData } = supabase.storage.from(SHOP_COVER_BUCKET).getPublicUrl(storagePath);

            const { error: updateError } = await supabase
                .from('shops')
                .update({ banner_url: publicUrlData.publicUrl })
                .eq('uid', shopUid);

            if (updateError) {
                throw new Error(updateError.message);
            }

            await refetch();
            showModaAlert('Success', 'Store cover photo updated.');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update cover photo.';
            showModaAlert('Update failed', message);
        } finally {
            setIsStoreActionLoading(false);
        }
    };

    if (shopUid === null) {
        return (
            <SafeScreen style={styles.container} edges={SHOP_LANDING_SAFE_AREA_EDGES}>
                <EmptyList
                    icon={<MaterialIcons name="storefront" size={48} color={theme.textSecondary} />}
                    message="Store not found"
                    submessage="The store link is missing or invalid."
                />
            </SafeScreen>
        );
    }

    if (isError) {
        return (
            <SafeScreen style={styles.container} edges={SHOP_LANDING_SAFE_AREA_EDGES}>
                <EmptyList
                    icon={<MaterialIcons name="error-outline" size={48} color={theme.textSecondary} />}
                    message="Unable to load this store"
                    submessage="Please check your connection and try again."
                    actionButton={{
                        label: 'Retry',
                        onPress: () => {
                            void refetch();
                        },
                    }}
                />
            </SafeScreen>
        );
    }

    if (!isLoading && (myStoreData === null || myStoreData === undefined)) {
        return (
            <SafeScreen style={styles.container} edges={SHOP_LANDING_SAFE_AREA_EDGES}>
                <EmptyList
                    icon={<MaterialIcons name="store-mall-directory" size={48} color={theme.textSecondary} />}
                    message="Store not found"
                    submessage="This seller store is no longer available."
                />
            </SafeScreen>
        );
    }

    return (
        <SafeScreen style={styles.container} edges={SHOP_LANDING_SAFE_AREA_EDGES}>
            <ShopBanner
                shopName={myStoreData?.shop.shopName ?? 'My Store'}
                location={myStoreData?.shop.location ?? 'Loading location...'}
                description={myStoreData?.shop.description ?? ''}
                followerCount={myStoreData?.shop.followerCount ?? 0}
                bannerUrl={myStoreData?.shop.bannerUrl}
                isOwner={isOwner && !isLoading}
                isFollowing={isFollowing}
                onFollowToggle={handleFollowToggle}
                onChatPress={handleChatPress}
                isStoreActionLoading={isStoreActionLoading}
                isDescriptionSaving={isDescriptionSaving}
                isLoading={isLoading}
                onEditCoverPress={() => {
                    void handleChangeStoreCover();
                }}
                isEditingStoreTitle={isEditingStoreTitle}
                storeTitleDraft={storeTitleDraft}
                onStoreTitleDraftChange={setStoreTitleDraft}
                onStartStoreTitleEdit={handleStartStoreTitleEdit}
                onSaveStoreTitle={() => {
                    void handleSaveStoreTitle();
                }}
                onCancelStoreTitleEdit={handleCancelStoreTitleEdit}
                isEditingStoreDescription={isEditingStoreDescription}
                storeDescriptionDraft={storeDescriptionDraft}
                onStoreDescriptionDraftChange={setStoreDescriptionDraft}
                onStartStoreDescriptionEdit={handleStartStoreDescriptionEdit}
                onSaveStoreDescription={() => {
                    void handleSaveStoreDescription();
                }}
                onCancelStoreDescriptionEdit={handleCancelStoreDescriptionEdit}
            />

            <ShopTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isOwner={isOwner}
            />

            <View style={styles.tabContent}>
                {!isTabContentReady ? (
                    <LoadingIndicator overlay={false} message="Loading products..." />
                ) : activeTab === 'All' ? (
                    <StoreProductsGrid
                        products={myStoreData?.products ?? []}
                        onProductPress={handleProductPress}
                        layout="list"
                        isLoading={isLoading}
                        emptyMessage="No products found"
                        emptySubmessage="You have not uploaded products yet."
                    />
                ) : activeTab === 'Tagged' ? (
                    <TaggedProductsList
                        products={myStoreData?.products ?? []}
                        onTagPress={handleTagPress}
                        isLoading={isLoading}
                    />
                ) : (
                    <StoreProductsGrid
                        products={bestSellerProducts}
                        onProductPress={handleProductPress}
                        layout="list"
                        isLoading={isLoading}
                        emptyMessage="No sales data yet"
                        emptySubmessage="Best sellers will appear here once products start getting sold."
                    />
                )}
            </View>

            {isStoreActionLoading && <LoadingIndicator overlay={true} message={storeActionMessage} />}
            {isFetching && !isLoading && !isStoreActionLoading && !isDescriptionSaving && <LoadingIndicator overlay={true} message="Refreshing My Store..." />}

            <ModaAlertModal
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                positiveLabel={alertState.positiveLabel}
                onPositivePress={hideModaAlert}
            />
        </SafeScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    tabContent: {
        flex: 1,
    },
});
