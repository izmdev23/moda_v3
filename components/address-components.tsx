import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../supabase/supabaseClient';
import { lightPalette } from '../utils/theme';
import { BoundaryItem } from '../utils/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressData {
    readonly uid: string;
    readonly country: string;
    readonly province: string;
    readonly city: string;
    readonly barangay: string;
    readonly address_detail: string;
    readonly landmark: string | null;
    readonly phone_number: string;
    readonly is_default: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;

// ─── AddressCard ──────────────────────────────────────────────────────────────

interface AddressCardProps {
    readonly address: AddressData;
    readonly onEdit: (address: AddressData) => void;
    readonly onDelete: (uid: string) => void;
    readonly onSetDefault: (uid: string) => void;
}

/**
 * Displays a single saved address with edit/delete/set-default actions.
 * Shows a "Default" badge for the primary delivery address.
 */
export const AddressCard: React.FC<AddressCardProps> = ({
    address,
    onEdit,
    onDelete,
    onSetDefault,
}): React.JSX.Element => {
    const fullAddress = [
        address.address_detail,
        address.barangay,
        address.city,
        address.province,
        address.country,
    ]
        .filter(Boolean)
        .join(', ');

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <Text style={styles.cardPhone}>📞 {address.phone_number}</Text>
                    {address.is_default && (
                        <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                    )}
                </View>
            </View>

            <Text style={styles.cardAddress} numberOfLines={3}>
                {fullAddress}
            </Text>

            {address.landmark !== null && address.landmark.length > 0 && (
                <Text style={styles.cardLandmark}>📍 {address.landmark}</Text>
            )}

            <View style={styles.cardActions}>
                {!address.is_default && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => onSetDefault(address.uid)}
                        id={`set-default-${address.uid}`}
                    >
                        <Text style={styles.actionBtnText}>Set Default</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => onEdit(address)}
                    id={`edit-address-${address.uid}`}
                >
                    <Text style={styles.actionBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => onDelete(address.uid)}
                    id={`delete-address-${address.uid}`}
                >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ─── CascadingDropdown ────────────────────────────────────────────────────────

interface CascadingDropdownProps {
    readonly label: string;
    readonly value: string;
    readonly items: BoundaryItem[];
    readonly onSelect: (name: string) => void;
    readonly disabled?: boolean;
    readonly loading?: boolean;
    readonly placeholder?: string;
}

/**
 * A single-level dropdown picker backed by a Modal bottom-sheet.
 * Used as building blocks for the cascading country→province→city→barangay flow.
 */
export const CascadingDropdown: React.FC<CascadingDropdownProps> = ({
    label,
    value,
    items,
    onSelect,
    disabled = false,
    loading = false,
    placeholder = 'Select…',
}): React.JSX.Element => {
    const [open, setOpen] = useState<boolean>(false);

    const handleSelect = useCallback(
        (name: string): void => {
            onSelect(name);
            setOpen(false);
        },
        [onSelect],
    );

    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TouchableOpacity
                style={[styles.dropdownTrigger, disabled && styles.dropdownDisabled]}
                onPress={() => { if (!disabled) setOpen(true); }}
                activeOpacity={disabled ? 1 : 0.7}
                id={`dropdown-${label}`}
            >
                <Text
                    style={[
                        styles.dropdownTriggerText,
                        value.length === 0 && styles.dropdownPlaceholder,
                    ]}
                    numberOfLines={1}
                >
                    {value.length > 0 ? value : placeholder}
                </Text>
                <Text style={styles.dropdownChevron}>{disabled ? '—' : '▾'}</Text>
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="slide">
                <View style={styles.sheetOverlay}>
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{label}</Text>
                            <TouchableOpacity onPress={() => setOpen(false)} id={`close-dropdown-${label}`}>
                                <Text style={styles.sheetClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={items}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.sheetItem,
                                        item.name === value && styles.sheetItemSelected,
                                    ]}
                                    onPress={() => handleSelect(item.name)}
                                    id={`option-${label}-${item.id}`}
                                >
                                    <Text
                                        style={[
                                            styles.sheetItemText,
                                            item.name === value && styles.sheetItemTextSelected,
                                        ]}
                                    >
                                        {item.name}
                                    </Text>
                                    {item.name === value && (
                                        <Text style={styles.sheetItemCheck}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyDropdown}>
                                    {loading ? (
                                        <ActivityIndicator size="small" color={lightPalette.primary} />
                                    ) : (
                                        <Text style={styles.emptyDropdownText}>No options available.</Text>
                                    )}
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ─── AddressForm ──────────────────────────────────────────────────────────────

interface AddressFormProps {
    readonly userId: number;
    readonly shopAddress?: ShopAddressData | null;
    readonly initialData?: AddressData | null;
    readonly onSave: (address: AddressData) => void;
    readonly onCancel: () => void;
    readonly currentCount: number;
}

export interface ShopAddressData {
    readonly country: string;
    readonly province: string;
    readonly city: string;
}

interface BoundaryCache {
    [key: string]: BoundaryItem[];
}

// In-memory cache for admin boundaries (rarely changes)
const boundaryCache: BoundaryCache = {};

/**
 * Full address creation/edit form with cascading dropdowns for PH administrative boundaries.
 * - Validates phone number format
 * - Supports pre-population for editing
 * - "Copy from shop address" for sellers
 * - Enforces max 10 addresses
 */
export const AddressForm: React.FC<AddressFormProps> = ({
    userId,
    shopAddress,
    initialData,
    onSave,
    onCancel,
    currentCount,
}): React.JSX.Element => {
    // ─── Boundary state ───────────────────────────────────────────────────
    const [countries, setCountries] = useState<BoundaryItem[]>([]);
    const [provinces, setProvinces] = useState<BoundaryItem[]>([]);
    const [cities, setCities] = useState<BoundaryItem[]>([]);
    const [barangays, setBarangays] = useState<BoundaryItem[]>([]);
    const [loadingBoundary, setLoadingBoundary] = useState<boolean>(false);

    // ─── Form state ───────────────────────────────────────────────────────
    const [country, setCountry] = useState<string>(initialData?.country ?? '');
    const [province, setProvince] = useState<string>(initialData?.province ?? '');
    const [city, setCity] = useState<string>(initialData?.city ?? '');
    const [barangay, setBarangay] = useState<string>(initialData?.barangay ?? '');
    const [addressDetail, setAddressDetail] = useState<string>(initialData?.address_detail ?? '');
    const [landmark, setLandmark] = useState<string>(initialData?.landmark ?? '');
    const [phoneNumber, setPhoneNumber] = useState<string>(initialData?.phone_number ?? '');
    const [saving, setSaving] = useState<boolean>(false);

    const getBoundariesFromDB = useCallback(
        async (level: number, parentId: number | null): Promise<BoundaryItem[]> => {
            const cacheKey = `${level}-${parentId ?? 'root'}`;
            if (boundaryCache[cacheKey] !== undefined) {
                return boundaryCache[cacheKey];
            }

            setLoadingBoundary(true);
            try {
                let query = supabase
                    .from('administrative_boundaries')
                    .select('id, name')
                    .eq('level', level)
                    .order('name');

                if (parentId !== null) {
                    query = query.eq('parent_id', parentId);
                }

                const { data } = await query;
                const items: BoundaryItem[] = (data ?? []).map((d) => ({
                    id: d.id,
                    name: d.name,
                }));
                boundaryCache[cacheKey] = items;
                return items;
            } finally {
                setLoadingBoundary(false);
            }
        },
        [],
    );

    // ─── Initialize: Load all necessary boundaries ───────────────────────
    const initializeForm = useCallback(async (): Promise<void> => {
        const countryItems = await getBoundariesFromDB(0, null);
        setCountries(countryItems);

        // For edits, pre-load the children so dropdowns aren't empty when clicked
        if (initialData !== null && initialData !== undefined) {
            const countryItem = countryItems.find((c: BoundaryItem) => c.name === initialData.country);
            if (countryItem !== undefined) {
                const provinceItems = await getBoundariesFromDB(1, countryItem.id);
                setProvinces(provinceItems);

                const provinceItem = provinceItems.find((p: BoundaryItem) => p.name === initialData.province);
                if (provinceItem !== undefined) {
                    const cityItems = await getBoundariesFromDB(2, provinceItem.id);
                    setCities(cityItems);

                    const cityItem = cityItems.find((c: BoundaryItem) => c.name === initialData.city);
                    if (cityItem !== undefined) {
                        const barangayItems = await getBoundariesFromDB(3, cityItem.id);
                        setBarangays(barangayItems);
                    }
                }
            }
        }
    }, [getBoundariesFromDB, initialData]);

    useEffect(() => {
        void initializeForm();
    }, [initializeForm]);

    // ─── Cascading selections ──────────────────────────────────────────────

    const handleCountrySelect = useCallback(
        async (name: string): Promise<void> => {
            setCountry(name);
            // Reset children
            setProvince('');
            setCity('');
            setBarangay('');
            setProvinces([]);
            setCities([]);
            setBarangays([]);
            // Load provinces for chosen country
            const countryItem = countries.find((c) => c.name === name);
            if (countryItem !== undefined) {
                const items = await getBoundariesFromDB(1, countryItem.id);
                setProvinces(items);
            }
        },
        [countries, getBoundariesFromDB],
    );

    const handleProvinceSelect = useCallback(
        async (name: string): Promise<void> => {
            setProvince(name);
            setCity('');
            setBarangay('');
            setCities([]);
            setBarangays([]);
            const provinceItem = provinces.find((p) => p.name === name);
            if (provinceItem !== undefined) {
                const items = await getBoundariesFromDB(2, provinceItem.id);
                setCities(items);
            }
        },
        [provinces, getBoundariesFromDB],
    );

    const handleCitySelect = useCallback(
        async (name: string): Promise<void> => {
            setCity(name);
            setBarangay('');
            setBarangays([]);
            const cityItem = cities.find((c) => c.name === name);
            if (cityItem !== undefined) {
                const items = await getBoundariesFromDB(3, cityItem.id);
                setBarangays(items);
            }
        },
        [cities, getBoundariesFromDB],
    );

    // ─── Copy from shop ────────────────────────────────────────────────────

    const handleCopyFromShop = useCallback(async (): Promise<void> => {
        if (shopAddress === null || shopAddress === undefined) return;
        setCountry(shopAddress.country);
        setProvince(shopAddress.province);
        setCity(shopAddress.city);
        setBarangay('');
        setBarangays([]);

        // Load cascading data
        const countryItem = countries.find((c: BoundaryItem) => c.name === shopAddress.country);
        if (countryItem !== undefined) {
            const provinceItems = await getBoundariesFromDB(1, countryItem.id);
            setProvinces(provinceItems);

            const provinceItem = provinceItems.find((p: BoundaryItem) => p.name === shopAddress.province);
            if (provinceItem !== undefined) {
                const cityItems = await getBoundariesFromDB(2, provinceItem.id);
                setCities(cityItems);

                const cityItem = cityItems.find((c: BoundaryItem) => c.name === shopAddress.city);
                if (cityItem !== undefined) {
                    const barangayItems = await getBoundariesFromDB(3, cityItem.id);
                    setBarangays(barangayItems);
                }
            }
        }
    }, [shopAddress, countries, getBoundariesFromDB]);

    // ─── Validate & Save ───────────────────────────────────────────────────

    const handleSave = useCallback(async (): Promise<void> => {
        if (country.length === 0 || province.length === 0 || city.length === 0 || barangay.length === 0) {
            Alert.alert('Missing Fields', 'Please fill in all location fields.');
            return;
        }
        if (addressDetail.trim().length === 0) {
            Alert.alert('Missing Fields', 'Please enter your block/lot/street details.');
            return;
        }
        if (!PHONE_REGEX.test(phoneNumber.trim())) {
            Alert.alert('Invalid Phone', 'Please enter a valid phone number (7–20 characters).');
            return;
        }

        setSaving(true);
        try {
            if (initialData !== null && initialData !== undefined) {
                // Update existing
                const { data, error } = await supabase
                    .from('addresses')
                    .update({
                        country,
                        province,
                        city,
                        barangay,
                        address_detail: addressDetail.trim(),
                        landmark: landmark.trim().length > 0 ? landmark.trim() : null,
                        phone_number: phoneNumber.trim(),
                    })
                    .eq('uid', initialData.uid)
                    .select('uid, country, province, city, barangay, address_detail, landmark, phone_number, is_default')
                    .single();

                if (error !== null) throw error;
                if (data !== null) {
                    onSave({
                        uid: data.uid,
                        country: data.country,
                        province: data.province,
                        city: data.city,
                        barangay: data.barangay,
                        address_detail: data.address_detail,
                        landmark: data.landmark,
                        phone_number: data.phone_number,
                        is_default: data.is_default,
                    });
                }
            } else {
                // Create new
                const isFirst = currentCount === 0;
                const { data, error } = await supabase
                    .from('addresses')
                    .insert({
                        user_id: userId,
                        country,
                        province,
                        city,
                        barangay,
                        address_detail: addressDetail.trim(),
                        landmark: landmark.trim().length > 0 ? landmark.trim() : null,
                        phone_number: phoneNumber.trim(),
                        is_default: isFirst,
                    })
                    .select('uid, country, province, city, barangay, address_detail, landmark, phone_number, is_default')
                    .single();

                if (error !== null) throw error;
                if (data !== null) {
                    onSave({
                        uid: data.uid,
                        country: data.country,
                        province: data.province,
                        city: data.city,
                        barangay: data.barangay,
                        address_detail: data.address_detail,
                        landmark: data.landmark,
                        phone_number: data.phone_number,
                        is_default: data.is_default,
                    });
                }
            }
        } catch {
            Alert.alert('Error', 'Failed to save address. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [country, province, city, barangay, addressDetail, landmark, phoneNumber, userId, initialData, currentCount, onSave]);

    return (
        <KeyboardAvoidingView
            style={styles.formRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.formScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>
                        {initialData !== null && initialData !== undefined ? 'Edit Address' : 'Add New Address'}
                    </Text>
                    <TouchableOpacity onPress={onCancel} id="close-address-form">
                        <Text style={styles.cancelText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Copy from shop */}
                {shopAddress !== null && shopAddress !== undefined && initialData === null && (
                    <TouchableOpacity
                        style={styles.copyShopBtn}
                        onPress={() => { void handleCopyFromShop(); }}
                        id="copy-from-shop"
                    >
                        <Text style={styles.copyShopText}>📋 Copy from shop address</Text>
                    </TouchableOpacity>
                )}

                {loadingBoundary && (
                    <ActivityIndicator size="small" color={lightPalette.primary} style={{ marginBottom: 8 }} />
                )}

                {/* Cascading dropdowns */}
                <CascadingDropdown
                    label="Country"
                    value={country}
                    items={countries}
                    loading={loadingBoundary}
                    onSelect={(name) => { void handleCountrySelect(name); }}
                    placeholder="Select country…"
                />
                <CascadingDropdown
                    label="Province"
                    value={province}
                    items={provinces}
                    loading={loadingBoundary}
                    onSelect={(name) => { void handleProvinceSelect(name); }}
                    disabled={country.length === 0}
                    placeholder="Select province…"
                />
                <CascadingDropdown
                    label="City / Municipality"
                    value={city}
                    items={cities}
                    loading={loadingBoundary}
                    onSelect={(name) => { void handleCitySelect(name); }}
                    disabled={province.length === 0}
                    placeholder="Select city…"
                />
                <CascadingDropdown
                    label="Barangay"
                    value={barangay}
                    items={barangays}
                    loading={loadingBoundary}
                    onSelect={setBarangay}
                    disabled={city.length === 0}
                    placeholder="Select barangay…"
                />

                {/* Text fields */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Block / Lot / Street *</Text>
                    <TextInput
                        style={styles.textInput}
                        value={addressDetail}
                        onChangeText={setAddressDetail}
                        placeholder="e.g. Blk 3 Lot 12, Sampaguita St."
                        placeholderTextColor={lightPalette.gray}
                        id="address-detail-input"
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Landmark (optional)</Text>
                    <TextInput
                        style={styles.textInput}
                        value={landmark}
                        onChangeText={setLandmark}
                        placeholder="e.g. Near SM Mall"
                        placeholderTextColor={lightPalette.gray}
                        id="landmark-input"
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Phone Number *</Text>
                    <TextInput
                        style={styles.textInput}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="+63 912 345 6789"
                        placeholderTextColor={lightPalette.gray}
                        keyboardType="phone-pad"
                        id="phone-input"
                    />
                </View>

                {/* Actions */}
                <View style={styles.formActions}>
                    <TouchableOpacity style={styles.cancelFormBtn} onPress={onCancel} id="cancel-form-btn">
                        <Text style={styles.cancelFormText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                        onPress={() => { void handleSave(); }}
                        disabled={saving}
                        id="save-address-btn"
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color={lightPalette.white} />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Address</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // AddressCard
    card: {
        backgroundColor: lightPalette.cardBackground,
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 6,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    cardPhone: {
        fontSize: 14,
        fontWeight: '600',
        color: lightPalette.textPrimary,
    },
    defaultBadge: {
        backgroundColor: lightPalette.primary,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    defaultBadgeText: {
        color: lightPalette.white,
        fontSize: 11,
        fontWeight: '700',
    },
    cardAddress: {
        fontSize: 14,
        color: lightPalette.textSecondary,
        lineHeight: 20,
        marginBottom: 4,
    },
    cardLandmark: {
        fontSize: 12,
        color: lightPalette.gray,
        marginBottom: 8,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        flexWrap: 'wrap',
    },
    actionBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: lightPalette.border,
        backgroundColor: lightPalette.cardBackground,
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: lightPalette.textPrimary,
    },
    deleteBtn: {
        borderColor: lightPalette.error,
        backgroundColor: 'rgba(245,54,92,0.07)',
    },
    deleteBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: lightPalette.error,
    },

    // CascadingDropdown
    fieldGroup: {
        marginBottom: 14,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: lightPalette.textSecondary,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: lightPalette.border,
        backgroundColor: lightPalette.cardBackground,
    },
    dropdownDisabled: {
        backgroundColor: '#F4F4F8',
        borderColor: '#E0E0E8',
    },
    dropdownTriggerText: {
        fontSize: 15,
        color: lightPalette.textPrimary,
        flex: 1,
    },
    dropdownPlaceholder: {
        color: lightPalette.gray,
    },
    dropdownChevron: {
        fontSize: 14,
        color: lightPalette.gray,
        marginLeft: 8,
    },

    // Bottom-sheet modal
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: lightPalette.cardBackground,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
        paddingBottom: 32,
        maxHeight: '70%',
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: lightPalette.border,
        marginBottom: 4,
    },
    sheetTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: lightPalette.textPrimary,
    },
    sheetClose: {
        fontSize: 18,
        color: lightPalette.gray,
        padding: 4,
    },
    sheetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: lightPalette.border,
    },
    sheetItemSelected: {
        backgroundColor: 'rgba(244,67,54,0.06)',
    },
    sheetItemText: {
        flex: 1,
        fontSize: 15,
        color: lightPalette.textPrimary,
    },
    sheetItemTextSelected: {
        color: lightPalette.primary,
        fontWeight: '600',
    },
    sheetItemCheck: {
        color: lightPalette.primary,
        fontSize: 16,
        fontWeight: '700',
    },
    emptyDropdown: {
        padding: 32,
        alignItems: 'center',
    },
    emptyDropdownText: {
        fontSize: 14,
        color: lightPalette.gray,
        textAlign: 'center',
    },

    // AddressForm
    formRoot: {
        flex: 1,
        backgroundColor: lightPalette.background,
    },
    formScroll: {
        padding: 20,
        paddingBottom: 40,
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    formTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: lightPalette.textPrimary,
    },
    cancelText: {
        fontSize: 20,
        color: lightPalette.gray,
        padding: 4,
    },
    copyShopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(244,67,54,0.08)',
        marginBottom: 16,
    },
    copyShopText: {
        color: lightPalette.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    textInput: {
        borderWidth: 1,
        borderColor: lightPalette.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: lightPalette.textPrimary,
        backgroundColor: lightPalette.cardBackground,
    },
    formActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    cancelFormBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: lightPalette.border,
        alignItems: 'center',
    },
    cancelFormText: {
        fontSize: 15,
        fontWeight: '700',
        color: lightPalette.textSecondary,
    },
    saveBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: lightPalette.primary,
        alignItems: 'center',
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
    saveBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: lightPalette.white,
    },
});
