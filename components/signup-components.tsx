import { RipplePressable } from '@/components/ui/ripple-pressable';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Control, Controller, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import {
    ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View
} from 'react-native';
import { administrativeBoundariesTable } from '../utils/database/administrative-boundaries-table';
import { BoundaryItem, Gender, UserRole } from '../utils/types';
import { validatePassword } from '../utils/utils';
import { CascadingDropdown } from './address-components';
import { FormInput } from './ui/form-input';
import { useTheme } from './ui/theme-provider';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SignupFormData {
    readonly accountType: UserRole;
    readonly firstName: string;
    readonly middleName: string;
    readonly lastName: string;
    readonly gender: Gender;
    readonly dateOfBirth: string; // ISO date string YYYY-MM-DD
    readonly email: string;
    readonly password: string;
    readonly confirmPassword: string;
    // Seller only
    readonly shopName: string;
    readonly shopCountry: string;
    readonly shopProvince: string;
    readonly shopCity: string;
    readonly shopBarangay: string;
    readonly shopBlockLot: string;
    readonly agreedToTerms: boolean;
}

// ─── WizardProgressBar ───────────────────────────────────────────────────────

interface WizardProgressBarProps {
    readonly totalSteps: number;
    readonly currentStep: number;
}

/**
 * Visual step progress bar shown at the top of the signup wizard.
 * Renders filled/empty circles for each step with connecting lines.
 */
export const WizardProgressBar: React.FC<WizardProgressBarProps> = ({
    totalSteps,
    currentStep,
}) => {
    const { theme } = useTheme();

    return (
        <View style={progressStyles.container}>
            {Array.from({ length: totalSteps }, (_, i) => {
                const stepNum = i + 1;
                const isCompleted = stepNum < currentStep;
                const isActive = stepNum === currentStep;
                const circleBackgroundColor = isCompleted || isActive ? theme.primary : theme.border;
                const circleTextColor = isCompleted || isActive ? theme.white : theme.gray;
                const lineBackgroundColor = isCompleted ? theme.primary : theme.border;

                return (
                    <React.Fragment key={stepNum}>
                        <View
                            style={[
                                progressStyles.circle,
                                { backgroundColor: circleBackgroundColor },
                            ]}
                        >
                            <Text
                                style={[
                                    progressStyles.circleText,
                                    { color: circleTextColor },
                                ]}
                            >
                                {isCompleted ? '✓' : stepNum}
                            </Text>
                        </View>
                        {stepNum < totalSteps && (
                            <View
                                style={[
                                    progressStyles.line,
                                    { backgroundColor: lineBackgroundColor },
                                ]}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
};

const progressStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
    },
    circle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    circleText: {
        fontSize: 13,
        fontWeight: '700',
    },
    line: {
        flex: 1,
        height: 2,
        marginHorizontal: 4,
    },
});

// ─── PasswordStrengthIndicator ────────────────────────────────────────────────

interface PasswordStrengthIndicatorProps {
    readonly password: string;
}

type PasswordStrength = 'empty' | 'weak' | 'medium' | 'strong';

const getPasswordStrength = (password: string): PasswordStrength => {
    if (password.length === 0) return 'empty';
    const { errors } = validatePassword(password);
    const missing = errors.length;
    if (missing >= 3) return 'weak';
    if (missing >= 1) return 'medium';
    return 'strong';
};

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
    empty: '',
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
};

/**
 * Visual bar + label that indicates the current strength of a password field.
 * Relies on the shared `validatePassword` utility from utils.ts.
 */
export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
    password,
}) => {
    const { theme } = useTheme();
    const strength = getPasswordStrength(password);
    const barWidth =
        strength === 'empty'
            ? '0%'
            : strength === 'weak'
                ? '33%'
                : strength === 'medium'
                    ? '66%'
                    : '100%';
    const strengthColors: Record<PasswordStrength, string> = {
        empty: theme.border,
        weak: theme.error,
        medium: theme.warning,
        strong: theme.success,
    };
    const color = strengthColors[strength];
    const label = STRENGTH_LABELS[strength];

    return (
        <View style={strengthStyles.container}>
            <View style={[strengthStyles.track, { backgroundColor: theme.border }]}>
                <View
                    style={[
                        strengthStyles.fill,
                        { width: barWidth as `${number}%`, backgroundColor: color },
                    ]}
                />
            </View>
            {label.length > 0 && (
                <Text style={[strengthStyles.label, { color }]}>{label}</Text>
            )}
        </View>
    );
};

const strengthStyles = StyleSheet.create({
    container: {
        marginTop: 6,
        marginBottom: 4,
    },
    track: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    fill: {
        height: 4,
        borderRadius: 2,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
});

// ─── Radio Select ─────────────────────────────────────────────────────────────

interface RadioOptionProps {
    readonly label: string;
    readonly selected: boolean;
    readonly onPress: () => void;
}

const RadioOption: React.FC<RadioOptionProps> = ({ label, selected, onPress }) => {
    const { theme } = useTheme();

    return (
        <RipplePressable
            style={[
                radioStyles.option,
                {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? `${theme.primary}14` : theme.background,
                },
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[radioStyles.circle, { borderColor: selected ? theme.primary : theme.gray }]}>
                {selected && <View style={[radioStyles.circleDot, { backgroundColor: theme.primary }]} />}
            </View>
            <Text
                style={[
                    radioStyles.label,
                    { color: selected ? theme.primary : theme.textSecondary, fontWeight: selected ? '700' : '500' },
                ]}
            >
                {label}
            </Text>
        </RipplePressable>
    );
};

const radioStyles = StyleSheet.create({
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1.5,
        marginBottom: 12,
    },
    circle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    circleDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    label: {
        fontSize: 15,
        fontWeight: '500',
    },
});

// ─── Step 1: AccountTypeStep ──────────────────────────────────────────────────

interface AccountTypeStepProps {
    readonly control: Control<SignupFormData>;
    readonly onNext: () => void;
}

/**
 * Wizard step 1 — lets the user choose between a Buyer or Seller account role.
 * Selection is bound via react-hook-form Controller, triggers onNext on selection.
 */
export const AccountTypeStep: React.FC<AccountTypeStepProps> = ({ control, onNext }) => {
    const { theme } = useTheme();

    return (
        <ScrollView contentContainerStyle={stepStyles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[stepStyles.title, { color: theme.textPrimary }]}>Join Moda</Text>
            <Text style={[stepStyles.subtitle, { color: theme.textSecondary }]}>How will you use Moda?</Text>
            <Controller
                control={control}
                name="accountType"
                rules={{ required: true }}
                render={({ field: { value, onChange } }) => (
                    <View>
                        <RadioOption
                            label="🛍️  I want to shop"
                            selected={value === 'buyer'}
                            onPress={() => {
                                onChange('buyer');
                                onNext();
                            }}
                        />
                        <RadioOption
                            label="🏪  I want to sell"
                            selected={value === 'seller'}
                            onPress={() => {
                                onChange('seller');
                                onNext();
                            }}
                        />
                    </View>
                )}
            />
        </ScrollView>
    );
};

// ─── Step 2: UserInfoStep ─────────────────────────────────────────────────────

interface UserInfoStepProps {
    readonly control: Control<SignupFormData>;
    readonly errors: Partial<Record<keyof SignupFormData, { message?: string }>>;
}

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Non-binary', value: 'non-binary' },
];

// Enforce 13+ years: max selectable DOB is today - 13 years
const getMaxDOB = (): string => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().split('T')[0];
};

const MAX_DOB = getMaxDOB();

/**
 * Wizard step 2 — collects name (first/middle/last), gender, and date of birth.
 * Enforces minimum age of 13 years via a max date validation on the DOB field.
 */
export const UserInfoStep: React.FC<UserInfoStepProps> = ({ control, errors }) => {
    const { theme } = useTheme();
    const [showPicker, setShowPicker] = useState(false);

    const handleDateChange = (
        _event: DateTimePickerEvent,
        selectedDate: Date | undefined,
        onChange: (value: string) => void
    ) => {
        // Close picker on Android immediately after selection
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }

        if (selectedDate) {
            // Format to YYYY-MM-DD for consistency with backend and state
            const formatted = selectedDate.toISOString().split('T')[0];
            onChange(formatted);
        }
    };

    return (
        <ScrollView contentContainerStyle={stepStyles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[stepStyles.title, { color: theme.textPrimary }]}>Personal Info</Text>
            <Text style={[stepStyles.subtitle, { color: theme.textSecondary }]}>Tell us about yourself</Text>

            <FormInput
                name="firstName"
                control={control}
                label="First Name *"
                placeholder="Enter your first name"
                rules={{ required: 'First name is required' }}
                error={errors.firstName?.message}
            />
            <FormInput
                name="middleName"
                control={control}
                label="Middle Name (Optional)"
                placeholder="Enter your middle name"
            />
            <FormInput
                name="lastName"
                control={control}
                label="Last Name *"
                placeholder="Enter your last name"
                rules={{ required: 'Last name is required' }}
                error={errors.lastName?.message}
            />

            {/* Gender Selection */}
            <Text style={[stepStyles.fieldLabel, { color: theme.textPrimary }]}>Gender *</Text>
            <Controller
                control={control}
                name="gender"
                rules={{ required: 'Gender is required' }}
                render={({ field: { value, onChange } }) => (
                    <View style={stepStyles.genderRow}>
                        {GENDER_OPTIONS.map((opt) => (
                            <RipplePressable
                                key={opt.value}
                                style={[
                                    stepStyles.genderChip,
                                    {
                                        borderColor: value === opt.value ? theme.primary : theme.border,
                                        backgroundColor: value === opt.value ? `${theme.primary}14` : theme.background,
                                    },
                                ]}
                                onPress={() => onChange(opt.value)}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        stepStyles.genderChipText,
                                        { color: value === opt.value ? theme.primary : theme.textSecondary },
                                        value === opt.value && stepStyles.genderChipTextSelected,
                                    ]}
                                >
                                    {opt.label}
                                </Text>
                            </RipplePressable>
                        ))}
                    </View>
                )}
            />
            {errors.gender?.message && (
                <Text style={[stepStyles.errorText, { color: theme.error }]}>{errors.gender.message}</Text>
            )}

            {/* Date of Birth Picker */}
            <View style={stepStyles.fieldContainer}>
                <Text style={[stepStyles.fieldLabel, { color: theme.textPrimary }]}>Date of Birth *</Text>
                <Controller
                    control={control}
                    name="dateOfBirth"
                    rules={{
                        required: 'Date of birth is required',
                        validate: (val: string) => {
                            if (val > MAX_DOB) return 'You must be at least 13 years old';
                            return true;
                        },
                    }}
                    render={({ field: { value, onChange } }) => (
                        <>
                            <RipplePressable
                                style={[
                                    stepStyles.pickerTrigger,
                                    {
                                        borderColor: errors.dateOfBirth ? theme.error : theme.border,
                                        backgroundColor: errors.dateOfBirth ? `${theme.error}14` : theme.background,
                                    },
                                ]}
                                onPress={() => setShowPicker(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    stepStyles.pickerText,
                                    { color: value ? theme.textPrimary : theme.gray },
                                    !value && stepStyles.pickerPlaceholderText,
                                ]}>
                                    {value || 'Select your date of birth'}
                                </Text>
                                <Ionicons
                                    name="calendar-outline"
                                    size={20}
                                    color={theme.primary}
                                />
                            </RipplePressable>

                            {showPicker && (
                                <DateTimePicker
                                    value={value ? new Date(value) : new Date(MAX_DOB)}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                                    maximumDate={new Date(MAX_DOB)}
                                    onChange={(e: DateTimePickerEvent, d?: Date) => handleDateChange(e, d, onChange)}
                                />
                            )}

                            {/* iOS specific confirm button for spinner display */}
                            {Platform.OS === 'ios' && showPicker && (
                                <RipplePressable
                                    style={[
                                        stepStyles.iosPickerConfirm,
                                        { backgroundColor: `${theme.primary}14`, borderColor: theme.primary },
                                    ]}
                                    onPress={() => setShowPicker(false)}
                                >
                                    <Text style={[stepStyles.iosPickerConfirmText, { color: theme.primary }]}>Done</Text>
                                </RipplePressable>
                            )}
                        </>
                    )}
                />
                {errors.dateOfBirth?.message && (
                    <Text style={[stepStyles.errorText, { color: theme.error }]}>{errors.dateOfBirth.message}</Text>
                )}
            </View>
        </ScrollView>
    );
};

// ─── Step 3: AccountInfoStep ──────────────────────────────────────────────────

interface AccountInfoStepProps {
    readonly control: Control<SignupFormData>;
    readonly errors: Partial<Record<keyof SignupFormData, { message?: string }>>;
    readonly watchPassword: string;
}

/**
 * Wizard step 3 — collects email, password (with strength indicator), and confirm password.
 * Email uniqueness is checked on blur (Step 6.5). Password strength is computed inline.
 */
export const AccountInfoStep: React.FC<AccountInfoStepProps> = ({
    control,
    errors,
    watchPassword,
}) => {
    const { theme } = useTheme();

    return (
        <ScrollView contentContainerStyle={stepStyles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[stepStyles.title, { color: theme.textPrimary }]}>Account Details</Text>
            <Text style={[stepStyles.subtitle, { color: theme.textSecondary }]}>Set up your login credentials</Text>

            <FormInput
                name="email"
                control={control}
                label="Email Address *"
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                rules={{
                    required: 'Email is required',
                    pattern: {
                        value: /\S+@\S+\.\S+/,
                        message: 'Enter a valid email address',
                    },
                }}
                error={errors.email?.message}
            />

            <View>
                <FormInput
                    name="password"
                    control={control}
                    label="Password *"
                    placeholder="Create a password"
                    secureTextEntry
                    rules={{
                        required: 'Password is required',
                        validate: (val: string) => {
                            const { isValid, errors: pErrors } = validatePassword(val);
                            return isValid || pErrors[0];
                        },
                    }}
                    error={errors.password?.message}
                />
                <PasswordStrengthIndicator password={watchPassword} />
            </View>

            <FormInput
                name="confirmPassword"
                control={control}
                label="Confirm Password *"
                placeholder="Re-enter your password"
                secureTextEntry
                rules={{
                    required: 'Please confirm your password',
                    validate: (val: string) =>
                        val === watchPassword || 'Passwords do not match',
                }}
                error={errors.confirmPassword?.message}
            />
        </ScrollView>
    );
};

// ─── Step 4: SellerInfoStep ───────────────────────────────────────────────────

interface SellerInfoStepProps {
    readonly control: Control<SignupFormData>;
    readonly errors: Partial<Record<keyof SignupFormData, { message?: string }>>;
    readonly setValue: UseFormSetValue<SignupFormData>;
    readonly watch: UseFormWatch<SignupFormData>;
}

/**
 * Wizard step 4 (seller-only) — collects shop name and address details
 * (country, province, city, barangay, block & lot). Consistent with the
 * address schema used throughout the rest of the app.
 * Populates address components from administrative_boundaries table.
 */
export const SellerInfoStep: React.FC<SellerInfoStepProps> = ({ control, errors, setValue, watch }) => {
    const { theme } = useTheme();
    const [countries, setCountries] = useState<BoundaryItem[]>([]);
    const [provinces, setProvinces] = useState<BoundaryItem[]>([]);
    const [cities, setCities] = useState<BoundaryItem[]>([]);
    const [barangays, setBarangays] = useState<BoundaryItem[]>([]);
    const [loadingBoundary, setLoadingBoundary] = useState<boolean>(false);

    const boundaryCache = useRef<{ [key: string]: BoundaryItem[] }>({});

    const watchCountry = watch('shopCountry');
    const watchProvince = watch('shopProvince');
    const watchCity = watch('shopCity');

    const fetchBoundaries = useCallback(async (level: number, parentId: number | null) => {
        const cacheKey = `${level}-${parentId ?? 'root'}`;
        if (boundaryCache.current[cacheKey]) return boundaryCache.current[cacheKey];

        setLoadingBoundary(true);
        try {
            const data = parentId === null
                ? await administrativeBoundariesTable.getRoot()
                : await administrativeBoundariesTable.getByParent(level, parentId);
            boundaryCache.current[cacheKey] = data;
            return data;
        } finally {
            setLoadingBoundary(false);
        }
    }, []);

    // Load initial countries
    useEffect(() => {
        fetchBoundaries(0, null).then(setCountries);
    }, [fetchBoundaries]);

    // Cascading: Load provinces when country changes
    useEffect(() => {
        const countryItem = countries.find(c => c.name === watchCountry);
        if (countryItem) {
            fetchBoundaries(1, countryItem.id).then(setProvinces);
        } else {
            setProvinces([]);
        }
    }, [watchCountry, countries, fetchBoundaries]);

    // Cascading: Load cities when province changes
    useEffect(() => {
        const provinceItem = provinces.find(p => p.name === watchProvince);
        if (provinceItem) {
            fetchBoundaries(2, provinceItem.id).then(setCities);
        } else {
            setCities([]);
        }
    }, [watchProvince, provinces, fetchBoundaries]);

    // Cascading: Load barangays when city changes
    useEffect(() => {
        const cityItem = cities.find(c => c.name === watchCity);
        if (cityItem) {
            fetchBoundaries(3, cityItem.id).then(setBarangays);
        } else {
            setBarangays([]);
        }
    }, [watchCity, cities, fetchBoundaries]);

    const handleCountrySelect = useCallback((name: string) => {
        setValue('shopCountry', name);
        setValue('shopProvince', '');
        setValue('shopCity', '');
        setValue('shopBarangay', '');
        setProvinces([]);
        setCities([]);
        setBarangays([]);
    }, [setValue]);

    const handleProvinceSelect = useCallback((name: string) => {
        setValue('shopProvince', name);
        setValue('shopCity', '');
        setValue('shopBarangay', '');
        setCities([]);
        setBarangays([]);
    }, [setValue]);

    const handleCitySelect = useCallback((name: string) => {
        setValue('shopCity', name);
        setValue('shopBarangay', '');
        setBarangays([]);
    }, [setValue]);

    return (
        <ScrollView contentContainerStyle={stepStyles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[stepStyles.title, { color: theme.textPrimary }]}>Shop Details</Text>
            <Text style={[stepStyles.subtitle, { color: theme.textSecondary }]}>Tell customers about your shop</Text>

            <FormInput
                name="shopName"
                control={control}
                label="Shop Name *"
                placeholder="Enter your shop name"
                rules={{ required: 'Shop name is required' }}
                error={errors.shopName?.message}
            />

            {loadingBoundary && (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginBottom: 8 }} />
            )}

            <Controller
                control={control}
                name="shopCountry"
                rules={{ required: 'Country is required' }}
                render={({ field: { value } }) => (
                    <View style={stepStyles.fieldContainer}>
                        <CascadingDropdown
                            label="Country *"
                            value={value}
                            items={countries}
                            loading={loadingBoundary}
                            onSelect={handleCountrySelect}
                            placeholder="Select country"
                        />
                        {errors.shopCountry?.message && (
                            <Text style={[stepStyles.errorText, { color: theme.error }]}>{errors.shopCountry.message}</Text>
                        )}
                    </View>
                )}
            />

            <Controller
                control={control}
                name="shopProvince"
                rules={{ required: 'Province is required' }}
                render={({ field: { value } }) => (
                    <View style={stepStyles.fieldContainer}>
                        <CascadingDropdown
                            label="Province *"
                            value={value}
                            items={provinces}
                            loading={loadingBoundary}
                            onSelect={handleProvinceSelect}
                            disabled={!watchCountry}
                            placeholder="Select province"
                        />
                        {errors.shopProvince?.message && (
                            <Text style={[stepStyles.errorText, { color: theme.error }]}>{errors.shopProvince.message}</Text>
                        )}
                    </View>
                )}
            />

            <Controller
                control={control}
                name="shopCity"
                rules={{ required: 'City is required' }}
                render={({ field: { value } }) => (
                    <View style={stepStyles.fieldContainer}>
                        <CascadingDropdown
                            label="City / Municipality *"
                            value={value}
                            items={cities}
                            loading={loadingBoundary}
                            onSelect={handleCitySelect}
                            disabled={!watchProvince}
                            placeholder="Select city"
                        />
                        {errors.shopCity?.message && (
                            <Text style={[stepStyles.errorText, { color: theme.error }]}>{errors.shopCity.message}</Text>
                        )}
                    </View>
                )}
            />

            <Controller
                control={control}
                name="shopBarangay"
                rules={{ required: 'Barangay is required' }}
                render={({ field: { value, onChange } }) => (
                    <View style={stepStyles.fieldContainer}>
                        <CascadingDropdown
                            label="Barangay *"
                            value={value}
                            items={barangays}
                            loading={loadingBoundary}
                            onSelect={onChange}
                            disabled={!watchCity}
                            placeholder="Select barangay"
                        />
                        {errors.shopBarangay?.message && (
                            <Text style={[stepStyles.errorText, { color: theme.error }]}>{errors.shopBarangay.message}</Text>
                        )}
                    </View>
                )}
            />

            <FormInput
                name="shopBlockLot"
                control={control}
                label="Block & Lot / Street *"
                placeholder="e.g. Blk 3 Lot 12 Mahogany St."
                rules={{ required: 'Block & lot is required' }}
                error={errors.shopBlockLot?.message}
            />
        </ScrollView>
    );
};

// ─── Step 5: ConfirmationStep ─────────────────────────────────────────────────

interface ConfirmationStepProps {
    readonly data: Partial<SignupFormData>;
    readonly control: Control<SignupFormData>;
    readonly agreedToTerms: boolean;
    readonly onToggleTerms: () => void;
    readonly onViewTerms: () => void;
}

/**
 * Wizard step 5 — displays a summary of collected data for the user to review,
 * includes a mandatory Terms & Conditions checkbox, and the submit action.
 */
export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
    data,
    agreedToTerms,
    onToggleTerms,
    onViewTerms,
}) => {
    const { theme } = useTheme();
    const isSeller = data.accountType === 'seller';

    return (
        <ScrollView contentContainerStyle={stepStyles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[stepStyles.title, { color: theme.textPrimary }]}>Almost there!</Text>
            <Text style={[stepStyles.subtitle, { color: theme.textSecondary }]}>Please review your information</Text>

            <View style={[confirmStyles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <SummaryRow label="Account Type" value={isSeller ? 'Seller' : 'Buyer'} />
                <SummaryRow
                    label="Name"
                    value={`${data.firstName ?? ''} ${data.middleName ? data.middleName + ' ' : ''}${data.lastName ?? ''}`.trim()}
                />
                <SummaryRow label="Gender" value={data.gender ?? ''} />
                <SummaryRow label="Date of Birth" value={data.dateOfBirth ?? ''} />
                <SummaryRow label="Email" value={data.email ?? ''} />
                {isSeller && (
                    <>
                        <SummaryRow label="Shop Name" value={data.shopName ?? ''} />
                        <SummaryRow
                            label="Shop Address"
                            value={`${data.shopBlockLot ?? ''}, ${data.shopBarangay ?? ''}, ${data.shopCity ?? ''}, ${data.shopProvince ?? ''}, ${data.shopCountry ?? ''}`}
                        />
                    </>
                )}
            </View>

            {/* Terms & Conditions */}
            <RipplePressable
                style={confirmStyles.termsRow}
                onPress={onToggleTerms}
                activeOpacity={0.7}
            >
                <View
                    style={[
                        confirmStyles.checkbox,
                        { borderColor: agreedToTerms ? theme.primary : theme.gray, backgroundColor: agreedToTerms ? theme.primary : theme.transparent },
                    ]}
                >
                    {agreedToTerms && <Text style={confirmStyles.checkmark}>✓</Text>}
                </View>
                <Text style={[confirmStyles.termsText, { color: theme.textSecondary }]}>
                    I agree to the{' '}
                    <Text style={[confirmStyles.termsLink, { color: theme.primary }]} onPress={onViewTerms}>
                        Terms & Conditions
                    </Text>
                </Text>
            </RipplePressable>
        </ScrollView>
    );
};

interface SummaryRowProps {
    readonly label: string;
    readonly value: string;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ label, value }) => {
    const { theme } = useTheme();

    return (
        <View style={[confirmStyles.row, { borderBottomColor: theme.border }]}>
            <Text style={[confirmStyles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
            <Text style={[confirmStyles.rowValue, { color: theme.textPrimary }]}>{value}</Text>
        </View>
    );
};

const confirmStyles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    rowLabel: {
        fontSize: 13,
        flex: 1,
    },
    rowValue: {
        fontSize: 13,
        fontWeight: '600',
        flex: 2,
        textAlign: 'right',
    },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 2,
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkmark: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    termsText: {
        fontSize: 14,
        flex: 1,
        flexWrap: 'wrap',
    },
    termsLink: {
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});

// ─── Shared Step Styles ───────────────────────────────────────────────────────

const stepStyles = StyleSheet.create({
    scrollContent: {
        // Extra bottom padding ensures the last field scrolls fully above the keyboard
        paddingBottom: 120,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    genderRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    genderChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    genderChipText: {
        fontSize: 13,
        fontWeight: '500',
    },
    genderChipTextSelected: {
        fontWeight: '700',
    },
    errorText: {
        fontSize: 12,
        marginTop: 4,
        marginBottom: 12,
    },
    fieldContainer: {
        marginBottom: 16,
    },
    pickerTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    pickerText: {
        fontSize: 16,
    },
    pickerPlaceholderText: {
    },
    iosPickerConfirm: {
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 8,
        borderWidth: 1,
    },
    iosPickerConfirmText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
