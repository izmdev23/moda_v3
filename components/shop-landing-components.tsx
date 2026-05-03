import { RipplePressable } from '@/components/ui/ripple-pressable';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';
import type { MyStoreProduct } from '../hooks/use-my-store';
import { formatPriceRange } from '../utils/utils';
import { AccessibleTouchable } from './ui/accessible-touchable';
import { EmptyList } from './ui/empty-list';
import { ProductCard } from './ui/product-card';
import { SkeletonLoader } from './ui/skeleton-loader';
import { useTheme } from './ui/theme-provider';

interface ShopBannerProps {
    readonly shopName: string;
    readonly location: string;
    readonly description: string;
    readonly followerCount: number;
    readonly bannerUrl?: string | null;
    readonly isOwner: boolean;
    readonly isFollowing: boolean;
    readonly onFollowToggle: () => void;
    readonly onChatPress: () => void;
    readonly isStoreActionLoading?: boolean;
    readonly isDescriptionSaving?: boolean;
    readonly onEditCoverPress?: () => void;
    readonly isEditingStoreTitle?: boolean;
    readonly storeTitleDraft?: string;
    readonly onStoreTitleDraftChange?: (title: string) => void;
    readonly onStartStoreTitleEdit?: () => void;
    readonly onSaveStoreTitle?: () => void;
    readonly onCancelStoreTitleEdit?: () => void;
    readonly isEditingStoreDescription?: boolean;
    readonly storeDescriptionDraft?: string;
    readonly onStoreDescriptionDraftChange?: (description: string) => void;
    readonly onStartStoreDescriptionEdit?: () => void;
    readonly onSaveStoreDescription?: () => void;
    readonly onCancelStoreDescriptionEdit?: () => void;
    readonly isLoading?: boolean;
}

const PLACEHOLDER_IMAGE = require('../assets/images/placeholder-image.svg');
const PLACEHOLDER_CONTENT_FIT: 'contain' = 'contain';

function containsHtmlTag(content: string): boolean {
    return /<[^>]+>/.test(content);
}

function escapeHtml(content: string): string {
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildDescriptionHtml(content: string): string {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
        return '';
    }

    if (containsHtmlTag(trimmed)) {
        return trimmed;
    }

    const escaped = escapeHtml(trimmed).replace(/\n/g, '<br/>');
    return `<p>${escaped}</p>`;
}

export const ShopBanner: React.FC<ShopBannerProps> = ({
    shopName,
    location,
    description,
    followerCount,
    bannerUrl,
    isOwner,
    isFollowing,
    onFollowToggle,
    onChatPress,
    isStoreActionLoading = false,
    isDescriptionSaving = false,
    onEditCoverPress,
    isEditingStoreTitle = false,
    storeTitleDraft = '',
    onStoreTitleDraftChange,
    onStartStoreTitleEdit,
    onSaveStoreTitle,
    onCancelStoreTitleEdit,
    isEditingStoreDescription = false,
    storeDescriptionDraft = '',
    onStoreDescriptionDraftChange,
    onStartStoreDescriptionEdit,
    onSaveStoreDescription,
    onCancelStoreDescriptionEdit,
    isLoading = false,
}) => {
    const { theme } = useTheme();
    const descriptionEditorRef = useRef<RichEditor>(null);
    const descriptionHtml = useMemo<string>(() => buildDescriptionHtml(description), [description]);
    const draftDescriptionHtml = useMemo<string>(() => buildDescriptionHtml(storeDescriptionDraft), [storeDescriptionDraft]);

    const showTitleInput = isOwner && isEditingStoreTitle && typeof onStoreTitleDraftChange === 'function';
    const showDescriptionEditor = isOwner && isEditingStoreDescription && typeof onStoreDescriptionDraftChange === 'function';

    if (isLoading) {
        return (
            <View style={[styles.bannerContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <View style={styles.bannerImageWrapper}>
                    <SkeletonLoader width="100%" height={120} borderRadius={0} />
                </View>

                <View style={styles.bannerContent}>
                    <View style={styles.bannerRow}>
                        <View style={styles.bannerMainInfo}>
                            <SkeletonLoader width="62%" height={18} style={styles.shopBannerSkeletonGap} />
                            <SkeletonLoader width="48%" height={12} />
                        </View>
                    </View>

                    <View style={styles.descriptionRow}>
                        <View style={styles.descriptionContent}>
                            <SkeletonLoader height={14} style={styles.shopBannerSkeletonGap} />
                            <SkeletonLoader height={14} width="70%" />
                        </View>
                    </View>

                    <SkeletonLoader width={86} height={12} />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.bannerContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
            <View style={styles.bannerImageWrapper}>
                {bannerUrl ? (
                    <Image
                        source={{ uri: bannerUrl }}
                        style={styles.bannerImage}
                        contentFit="cover"
                    />
                ) : (
                    <View style={[styles.bannerImage, styles.bannerPlaceholderWrap]}>
                        <Image
                            source={PLACEHOLDER_IMAGE}
                            style={styles.bannerPlaceholderImage}
                            contentFit={PLACEHOLDER_CONTENT_FIT}
                        />
                    </View>
                )}
                {isOwner && typeof onEditCoverPress === 'function' && (
                    <RipplePressable
                        style={[
                            styles.coverEditBtn,
                            { borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(0,0,0,0.55)' },
                            isStoreActionLoading && styles.coverEditBtnDisabled,
                        ]}
                        onPress={onEditCoverPress}
                        disabled={isStoreActionLoading}
                    >
                        <MaterialIcons name="edit" size={14} color={theme.white} />
                        <Text style={[styles.coverEditBtnText, { color: theme.white }]}>Edit</Text>
                    </RipplePressable>
                )}
            </View>
            <View style={styles.bannerContent}>
                <View style={styles.bannerRow}>
                    <View style={styles.bannerMainInfo}>
                        <View style={styles.shopNameRow}>
                            {showTitleInput ? (
                                <TextInput
                                    value={storeTitleDraft}
                                    onChangeText={onStoreTitleDraftChange}
                                    placeholder="Store title"
                                    placeholderTextColor={theme.textSecondary}
                                    style={[
                                        styles.shopNameInput,
                                        {
                                            color: theme.textPrimary,
                                            borderColor: theme.border,
                                            backgroundColor: theme.background,
                                        },
                                    ]}
                                    maxLength={80}
                                />
                            ) : (
                                <Text style={[styles.shopName, { color: theme.textPrimary }]}>{shopName}</Text>
                            )}

                            {isOwner && (
                                <View style={styles.inlineEditActions}>
                                    {isEditingStoreTitle ? (
                                        <>
                                            <RipplePressable
                                                style={[
                                                    styles.inlineEditBtn,
                                                    { borderColor: theme.border, backgroundColor: theme.cardBackground },
                                                    isStoreActionLoading && styles.inlineEditBtnDisabled,
                                                ]}
                                                onPress={onSaveStoreTitle}
                                                disabled={isStoreActionLoading}
                                            >
                                                <MaterialIcons name="check" size={16} color={theme.textPrimary} />
                                            </RipplePressable>
                                            <RipplePressable
                                                style={[
                                                    styles.inlineEditBtn,
                                                    { borderColor: theme.border, backgroundColor: theme.cardBackground },
                                                    isStoreActionLoading && styles.inlineEditBtnDisabled,
                                                ]}
                                                onPress={onCancelStoreTitleEdit}
                                                disabled={isStoreActionLoading}
                                            >
                                                <MaterialIcons name="close" size={16} color={theme.textSecondary} />
                                            </RipplePressable>
                                        </>
                                    ) : (
                                        <RipplePressable
                                            style={[
                                                styles.inlineEditBtn,
                                                { borderColor: theme.border, backgroundColor: theme.cardBackground },
                                                isStoreActionLoading && styles.inlineEditBtnDisabled,
                                            ]}
                                            onPress={onStartStoreTitleEdit}
                                            disabled={isStoreActionLoading || isDescriptionSaving}
                                        >
                                            <MaterialIcons name="edit" size={16} color={theme.textPrimary} />
                                        </RipplePressable>
                                    )}
                                </View>
                            )}
                        </View>

                        <View style={styles.locationRow}>
                            <MaterialIcons name="location-on" size={14} color={theme.textSecondary} />
                            <Text style={[styles.locationText, { color: theme.textSecondary }]}>{location}</Text>
                        </View>
                    </View>

                    {!isOwner && (
                        <View style={styles.actionsRow}>
                            <AccessibleTouchable
                                style={[styles.chatBtn, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                                onPress={onChatPress}
                                accessibilityLabel="Chat with Seller"
                            >
                                <MaterialIcons name="chat" size={18} color={theme.textPrimary} />
                            </AccessibleTouchable>
                            <AccessibleTouchable
                                style={[
                                    styles.followBtn,
                                    isFollowing
                                        ? { backgroundColor: theme.cardBackground, borderColor: theme.border }
                                        : { backgroundColor: theme.primary, borderColor: theme.primary },
                                ]}
                                onPress={onFollowToggle}
                                accessibilityLabel={isFollowing ? 'Unfollow Shop' : 'Follow Shop'}
                            >
                                <Text style={{ color: isFollowing ? theme.textPrimary : theme.white, fontWeight: '700', fontSize: 12 }}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Text>
                            </AccessibleTouchable>
                        </View>
                    )}
                </View>

                <View style={styles.descriptionRow}>
                    <View style={styles.descriptionContent}>
                        {isDescriptionSaving ? (
                            <View style={styles.descriptionSkeletonWrap}>
                                <SkeletonLoader height={14} style={{ marginBottom: 8 }} />
                                <SkeletonLoader height={14} width="75%" />
                            </View>
                        ) : showDescriptionEditor ? (
                            <View style={[styles.descriptionEditorContainer, { borderColor: theme.border }]}>
                                <RichToolbar
                                    editor={descriptionEditorRef}
                                    actions={[
                                        actions.setBold,
                                        actions.setItalic,
                                        actions.insertBulletsList,
                                        actions.insertOrderedList,
                                        actions.setUnderline,
                                        actions.setStrikethrough,
                                    ]}
                                    iconTint={theme.textSecondary}
                                    selectedIconTint={theme.primary}
                                    style={{ backgroundColor: theme.cardBackground }}
                                />
                                <RichEditor
                                    ref={descriptionEditorRef}
                                    initialContentHTML={draftDescriptionHtml}
                                    onChange={onStoreDescriptionDraftChange}
                                    placeholder="Describe your store"
                                    editorStyle={{
                                        backgroundColor: theme.background,
                                        color: theme.textPrimary,
                                        placeholderColor: theme.textSecondary,
                                    }}
                                    style={styles.descriptionEditor}
                                />
                            </View>
                        ) : descriptionHtml.length > 0 ? (
                            <RichEditor
                                key={`preview-${descriptionHtml}`}
                                disabled={true}
                                initialContentHTML={descriptionHtml}
                                editorStyle={{
                                    backgroundColor: theme.cardBackground,
                                    color: theme.textPrimary,
                                    placeholderColor: theme.textSecondary,
                                }}
                                style={styles.descriptionPreviewEditor}
                            />
                        ) : (
                            <Text style={[styles.description, { color: theme.textSecondary }]}>No shop description yet.</Text>
                        )}
                    </View>

                    {isOwner && (
                        <View style={styles.inlineEditActions}>
                            {isEditingStoreDescription ? (
                                <>
                                    <RipplePressable
                                        style={[
                                            styles.inlineEditBtn,
                                            { borderColor: theme.border, backgroundColor: theme.cardBackground },
                                            (isStoreActionLoading || isDescriptionSaving) && styles.inlineEditBtnDisabled,
                                        ]}
                                        onPress={onSaveStoreDescription}
                                        disabled={isStoreActionLoading || isDescriptionSaving}
                                    >
                                        <MaterialIcons name="check" size={16} color={theme.textPrimary} />
                                    </RipplePressable>
                                    <RipplePressable
                                        style={[
                                            styles.inlineEditBtn,
                                            { borderColor: theme.border, backgroundColor: theme.cardBackground },
                                            (isStoreActionLoading || isDescriptionSaving) && styles.inlineEditBtnDisabled,
                                        ]}
                                        onPress={onCancelStoreDescriptionEdit}
                                        disabled={isStoreActionLoading || isDescriptionSaving}
                                    >
                                        <MaterialIcons name="close" size={16} color={theme.textSecondary} />
                                    </RipplePressable>
                                </>
                            ) : (
                                <RipplePressable
                                    style={[
                                        styles.inlineEditBtn,
                                        { borderColor: theme.border, backgroundColor: theme.cardBackground },
                                        (isStoreActionLoading || isDescriptionSaving) && styles.inlineEditBtnDisabled,
                                    ]}
                                    onPress={onStartStoreDescriptionEdit}
                                    disabled={isStoreActionLoading || isDescriptionSaving}
                                >
                                    <MaterialIcons name="edit" size={16} color={theme.textPrimary} />
                                </RipplePressable>
                            )}
                        </View>
                    )}
                </View>

                <Text style={[styles.followerCount, { color: theme.textPrimary }]}>
                    <Text style={styles.boldText}>{followerCount}</Text> Followers
                </Text>
            </View>
        </View>
    );
};

export type ShopTabType = 'All' | 'Tagged' | 'Best';

interface ShopTabsProps {
    readonly activeTab: ShopTabType;
    readonly onTabChange: (tab: ShopTabType) => void;
    readonly isOwner: boolean;
}

export const ShopTabs: React.FC<ShopTabsProps> = ({ activeTab, onTabChange, isOwner: _isOwner }) => {
    const { theme } = useTheme();

    const tabs: ShopTabType[] = ['All', 'Tagged', 'Best'];

    return (
        <View style={[styles.tabsContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
                {tabs.map((tab) => {
                    let label = '';

                    switch (tab) {
                        case 'All':
                            label = 'All Products';
                            break;
                        case 'Tagged':
                            label = 'Tagged';
                            break;
                        case 'Best':
                            label = 'Best Sellers';
                            break;
                    }

                    const isActive = activeTab === tab;

                    return (
                        <RipplePressable
                            key={tab}
                            style={[styles.tabBtn, isActive && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
                            onPress={() => onTabChange(tab)}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    {
                                        color: isActive ? theme.primary : theme.textSecondary,
                                        fontWeight: isActive ? '700' : '400',
                                    },
                                ]}
                            >
                                {label}
                            </Text>
                        </RipplePressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

interface StoreProductsGridProps {
    readonly products: readonly MyStoreProduct[];
    readonly onProductPress: (uid: string) => void;
    readonly emptyMessage?: string;
    readonly emptySubmessage?: string;
    readonly scrollEnabled?: boolean;
    readonly layout?: 'grid' | 'list';
    readonly isLoading?: boolean;
}

export const StoreProductsGrid: React.FC<StoreProductsGridProps> = ({
    products,
    onProductPress,
    emptyMessage = 'No products found',
    emptySubmessage = 'This shop has not uploaded any products yet.',
    scrollEnabled = true,
    layout = 'grid',
    isLoading = false,
}) => {
    const { theme } = useTheme();
    const { width } = useWindowDimensions();

    const productData = useMemo<MyStoreProduct[]>(() => [...products], [products]);
    const isGridLayout = layout === 'grid';
    const cardWidth = Math.max((width - 56) / 2, 140);

    if (isLoading) {
        if (isGridLayout) {
            return (
                <View style={styles.productsGridSkeletonWrap}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <View key={`grid-skeleton-${index}`} style={[styles.productsGridSkeletonCard, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}> 
                            <SkeletonLoader width="100%" height={120} borderRadius={10} />
                            <SkeletonLoader width="78%" height={14} style={styles.productsGridSkeletonGap} />
                            <SkeletonLoader width="52%" height={13} />
                        </View>
                    ))}
                </View>
            );
        }

        return (
            <View style={styles.productsRowSkeletonWrap}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <View key={`row-skeleton-${index}`} style={[styles.productRowCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                        <SkeletonLoader width={112} height={112} />
                        <View style={styles.productsRowSkeletonBody}>
                            <SkeletonLoader width="78%" height={14} style={styles.productsRowSkeletonGap} />
                            <SkeletonLoader width="46%" height={13} style={styles.productsRowSkeletonGap} />
                            <SkeletonLoader width="60%" height={12} />
                        </View>
                    </View>
                ))}
            </View>
        );
    }

    if (productData.length === 0) {
        return (
            <View style={styles.productsContainer}>
                <EmptyList
                    icon={<MaterialIcons name="inventory-2" size={48} color={theme.textSecondary} />}
                    message={emptyMessage}
                    submessage={emptySubmessage}
                />
            </View>
        );
    }

    return (
        <FlatList
            data={productData}
            keyExtractor={(item) => item.uid}
            numColumns={isGridLayout ? 2 : 1}
            renderItem={({ item }) => {
                if (isGridLayout) {
                    return (
                        <ProductCard
                            uid={item.uid}
                            name={item.name}
                            thumbnailUrl={item.thumbnailUrl}
                            minPrice={item.minPrice}
                            maxPrice={item.maxPrice}
                            totalStock={item.totalStock}
                            salePrice={item.salePrice}
                            originalPriceForSale={item.originalPriceForSale}
                            rating={item.rating}
                            totalSales={item.totalSales}
                            onPress={onProductPress}
                            width={cardWidth}
                        />
                    );
                }

                return (
                    <RipplePressable
                        style={[styles.productRowCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                        onPress={() => onProductPress(item.uid)}
                        activeOpacity={0.8}
                    >
                        {item.thumbnailUrl.length > 0 ? (
                            <Image source={{ uri: item.thumbnailUrl }} style={styles.productRowImage} contentFit="cover" />
                        ) : (
                            <View style={[styles.productRowImagePlaceholder, { backgroundColor: theme.background }]}>
                                <Image source={PLACEHOLDER_IMAGE} style={styles.productRowPlaceholderImage} contentFit={PLACEHOLDER_CONTENT_FIT} />
                            </View>
                        )}

                        <View style={styles.productRowInfo}>
                            <Text style={[styles.productRowName, { color: theme.textPrimary }]} numberOfLines={2}>
                                {item.name}
                            </Text>

                            <Text style={[styles.productRowPrice, { color: theme.primary }]} numberOfLines={1}>
                                {formatPriceRange(item.minPrice, item.maxPrice)}
                            </Text>

                            <View style={styles.productRowMeta}>
                                <Text style={[styles.productRowMetaText, { color: theme.textSecondary }]}>★ {item.rating.toFixed(1)}</Text>
                                <Text style={[styles.productRowMetaText, { color: theme.textSecondary }]}>{item.totalSales} sold</Text>
                            </View>

                            <Text
                                style={[
                                    styles.productRowStock,
                                    { color: item.totalStock > 0 ? theme.success : theme.error },
                                ]}
                            >
                                Inventory: {item.totalStock}
                            </Text>
                        </View>
                    </RipplePressable>
                );
            }}
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={scrollEnabled}
            contentContainerStyle={isGridLayout ? styles.productsListContent : styles.productsRowListContent}
            columnWrapperStyle={isGridLayout ? styles.productsRow : undefined}
        />
    );
};

interface TagListItem {
    readonly key: string;
    readonly label: string;
    readonly count: number;
    readonly searchableLabel: string;
}

const UNTAGGED_SECTION_KEY = '__untagged__';
const UNTAGGED_SECTION_LABEL = 'Untagged';

function buildTagList(products: readonly MyStoreProduct[]): TagListItem[] {
    const tagsMap = new Map<string, { label: string; count: number }>();

    for (const product of products) {
        const normalizedTags = product.tags
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);

        if (normalizedTags.length === 0) {
            const existingUntagged = tagsMap.get(UNTAGGED_SECTION_KEY);

            if (existingUntagged) {
                existingUntagged.count += 1;
            } else {
                tagsMap.set(UNTAGGED_SECTION_KEY, {
                    label: UNTAGGED_SECTION_LABEL,
                    count: 1,
                });
            }

            continue;
        }

        const uniqueTagKeys = Array.from(new Set(normalizedTags.map((tag) => tag.toLowerCase())));

        for (const tagKey of uniqueTagKeys) {
            const label = normalizedTags.find((tag) => tag.toLowerCase() === tagKey) ?? tagKey;
            const existingTag = tagsMap.get(tagKey);

            if (existingTag) {
                existingTag.count += 1;
            } else {
                tagsMap.set(tagKey, {
                    label,
                    count: 1,
                });
            }
        }
    }

    return Array.from(tagsMap.entries())
        .map(([key, value]) => ({
            key,
            label: value.label,
            count: value.count,
            searchableLabel: value.label.toLowerCase(),
        }))
        .sort((a, b) => {
            if (a.key === UNTAGGED_SECTION_KEY) return 1;
            if (b.key === UNTAGGED_SECTION_KEY) return -1;
            return a.label.localeCompare(b.label);
        });
}

function parseTagSearchTerms(rawQuery: string): string[] {
    const terms = rawQuery
        .split(',')
        .map((segment) => segment.trim().toLowerCase())
        .filter((segment) => segment.length > 0);

    return Array.from(new Set(terms));
}

function filterTagsByQuery(tags: readonly TagListItem[], query: string): TagListItem[] {
    const terms = parseTagSearchTerms(query);
    if (terms.length === 0) {
        return [...tags];
    }

    return tags.filter((tagItem) => terms.some((term) => tagItem.searchableLabel.includes(term)));
}

interface TaggedProductsListProps {
    readonly products: readonly MyStoreProduct[];
    readonly onTagPress: (tagKey: string, tagLabel: string) => void;
    readonly isLoading?: boolean;
}

export const TaggedProductsList: React.FC<TaggedProductsListProps> = ({ products, onTagPress, isLoading = false }) => {
    const { theme } = useTheme();
    const [tagSearchQuery, setTagSearchQuery] = useState<string>('');

    const tags = useMemo<TagListItem[]>(() => buildTagList(products), [products]);
    const filteredTags = useMemo<TagListItem[]>(() => filterTagsByQuery(tags, tagSearchQuery), [tags, tagSearchQuery]);

    if (isLoading) {
        return (
            <View style={styles.taggedContainer}>
                <View style={[styles.tagSearchContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}> 
                    <SkeletonLoader width="100%" height={34} borderRadius={10} />
                </View>

                <View style={styles.tagListContent}>
                    {Array.from({ length: 5 }).map((_, index) => (
                        <View key={`tag-skeleton-${index}`} style={[styles.tagItemButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
                            <SkeletonLoader width="62%" height={14} />
                            <SkeletonLoader width={20} height={20} borderRadius={10} />
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    if (products.length === 0) {
        return (
            <View style={styles.productsContainer}>
                <EmptyList
                    icon={<MaterialIcons name="local-offer" size={48} color={theme.textSecondary} />}
                    message="No products found"
                    submessage="Upload products to start tagging your catalog."
                />
            </View>
        );
    }

    return (
        <View style={styles.taggedContainer}>
            <View style={[styles.tagSearchContainer, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}> 
                <MaterialIcons name="search" size={18} color={theme.textSecondary} style={styles.tagSearchIcon} />
                <TextInput
                    value={tagSearchQuery}
                    onChangeText={setTagSearchQuery}
                    placeholder="Search tags (e.g. vintage, summer)"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.tagSearchInput, { color: theme.textPrimary }]}
                    autoCorrect={false}
                    autoCapitalize="none"
                />
            </View>

            <FlatList
                data={filteredTags}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.tagListContent}
                renderItem={({ item }) => {
                    const labelText = item.key === UNTAGGED_SECTION_KEY ? UNTAGGED_SECTION_LABEL : `#${item.label}`;

                    return (
                        <RipplePressable
                            style={[styles.tagItemButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
                            onPress={() => onTagPress(item.key, item.label)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.tagItemMetaRow}>
                                <Text style={[styles.tagItemLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                                    {labelText}
                                </Text>
                                <View style={[styles.tagItemCountBadge, { backgroundColor: `${theme.primary}20` }]}>
                                    <Text style={[styles.tagItemCountText, { color: theme.primary }]}>{item.count}</Text>
                                </View>
                            </View>

                            <MaterialIcons name="chevron-right" size={20} color={theme.textSecondary} />
                        </RipplePressable>
                    );
                }}
                ListEmptyComponent={
                    <EmptyList
                        icon={<MaterialIcons name="tag" size={48} color={theme.textSecondary} />}
                        message="No matching tags"
                        submessage="Try searching with fewer or different tag keywords."
                    />
                }
            />
        </View>
    );
};

export type TimeFilter = 'Today' | 'Week' | 'Month' | 'Year' | 'AllTime';

interface BestSellersFilterProps {
    readonly onFilterChange: (filter: TimeFilter) => void;
}

export const BestSellersFilter: React.FC<BestSellersFilterProps> = ({ onFilterChange }) => {
    const { theme } = useTheme();
    const [active, setActive] = useState<TimeFilter>('AllTime');
    const filters: TimeFilter[] = ['Today', 'Week', 'Month', 'Year', 'AllTime'];

    const handlePress = (filter: TimeFilter): void => {
        setActive(filter);
        onFilterChange(filter);
    };

    return (
        <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                {filters.map((filter) => (
                    <RipplePressable
                        key={filter}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: active === filter ? `${theme.primary}20` : theme.cardBackground,
                                borderColor: active === filter ? theme.primary : theme.border,
                            },
                        ]}
                        onPress={() => handlePress(filter)}
                    >
                        <Text style={{ color: active === filter ? theme.primary : theme.textSecondary, fontSize: 12 }}>
                            {filter === 'AllTime' ? 'All Time' : filter}
                        </Text>
                    </RipplePressable>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    bannerContainer: {
        borderBottomWidth: 1,
        paddingBottom: 16,
    },
    bannerImageWrapper: {
        position: 'relative',
    },
    bannerImage: {
        width: '100%',
        height: 120,
        backgroundColor: '#E0E0E0',
    },
    bannerPlaceholderWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerPlaceholderImage: {
        width: '25%',
        height: '25%',
        opacity: 0.5,
    },
    coverEditBtn: {
        position: 'absolute',
        right: 10,
        bottom: 10,
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    coverEditBtnDisabled: {
        opacity: 0.6,
    },
    coverEditBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    bannerContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    bannerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    bannerMainInfo: {
        flex: 1,
    },
    shopBannerSkeletonGap: {
        marginBottom: 8,
    },
    shopNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    shopName: {
        fontSize: 20,
        fontWeight: '700',
        flex: 1,
    },
    shopNameInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 18,
        fontWeight: '700',
        marginRight: 8,
    },
    inlineEditBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
    },
    inlineEditActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginLeft: 8,
    },
    inlineEditBtnDisabled: {
        opacity: 0.6,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationText: {
        fontSize: 12,
        marginLeft: 4,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    chatBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    followBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    descriptionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
        marginBottom: 8,
    },
    descriptionContent: {
        flex: 1,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
    },
    descriptionSkeletonWrap: {
        paddingVertical: 6,
    },
    descriptionEditorContainer: {
        borderWidth: 1,
        borderRadius: 10,
        overflow: 'hidden',
    },
    descriptionEditor: {
        minHeight: 140,
    },
    descriptionPreviewEditor: {
        minHeight: 90,
    },
    followerCount: {
        fontSize: 14,
    },
    boldText: {
        fontWeight: '700',
    },
    tabsContainer: {
        borderBottomWidth: 1,
    },
    tabsScrollContent: {
        paddingHorizontal: 16,
    },
    tabBtn: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    tabText: {
        fontSize: 14,
    },
    productsContainer: {
        flex: 1,
    },
    productsGridSkeletonWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: 8,
    },
    productsGridSkeletonCard: {
        width: '48.5%',
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        marginBottom: 12,
    },
    productsGridSkeletonGap: {
        marginTop: 10,
        marginBottom: 8,
    },
    productsRowSkeletonWrap: {
        paddingHorizontal: 12,
        paddingTop: 8,
    },
    productsRowSkeletonBody: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    productsRowSkeletonGap: {
        marginBottom: 8,
    },
    productsListContent: {
        paddingHorizontal: 8,
    },
    productsRowListContent: {
        paddingHorizontal: 12,
    },
    productsRow: {
        justifyContent: 'space-between',
    },
    productRowCard: {
        borderWidth: 1,
        borderRadius: 14,
        overflow: 'hidden',
        flexDirection: 'row',
        marginBottom: 12,
    },
    productRowImage: {
        width: 112,
        height: 112,
    },
    productRowImagePlaceholder: {
        width: 112,
        height: 112,
        justifyContent: 'center',
        alignItems: 'center',
    },
    productRowPlaceholderImage: {
        width: '25%',
        height: '25%',
        opacity: 0.5,
    },
    productRowInfo: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        justifyContent: 'space-between',
    },
    productRowName: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    productRowPrice: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    productRowMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    productRowMetaText: {
        fontSize: 12,
    },
    productRowStock: {
        fontSize: 12,
        fontWeight: '700',
    },
    taggedContainer: {
        flex: 1,
    },
    tagSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    tagSearchIcon: {
        marginRight: 8,
    },
    tagSearchInput: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 6,
    },
    tagListContent: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    tagItemButton: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tagItemMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    tagItemLabel: {
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
    },
    tagItemCountBadge: {
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginLeft: 10,
    },
    tagItemCountText: {
        fontSize: 11,
        fontWeight: '700',
    },
    filterContainer: {
        paddingVertical: 12,
    },
    filterContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
});
