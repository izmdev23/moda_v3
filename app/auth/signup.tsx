import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Alert,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Animated as RNAnimated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeScreen } from '../../components/ui/safe-screen';
import { Animation } from '../../utils/animation';

import {
  AccountInfoStep,
  AccountTypeStep,
  ConfirmationStep,
  SellerInfoStep,
  SignupFormData,
  UserInfoStep,
  WizardProgressBar,
} from '../../components/signup-components';
import { LoadingModal } from '../../components/ui/loading-modal';
import { useTheme } from '../../components/ui/theme-provider';
import { supabase } from '../../supabase/supabaseClient';
import { authApi } from '../../utils/database/auth';
import { UserRole } from '../../utils/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - 48; // SCREEN_WIDTH - padding (24 * 2)

const TOTAL_BUYER_STEPS = 4; // Step 1→2→3→5 (skip seller step 4)
const TOTAL_SELLER_STEPS = 5; // Step 1→2→3→4→5

const TERMS_URL = 'https://moda.example.com/terms'; // Placeholder
const AUTH_EMAIL_SEND_FAILURE_FRAGMENT = 'Error sending confirmation email';
const SMTP_AUTH_FAILURE_FRAGMENT = '535 5.7.8';

/**
 * Maps wizard step index (0-based) to a user-facing step number.
 */
const getStepNumber = (stepIndex: number): number => stepIndex + 1; // displayed 1-based

// ─── SignupScreen ─────────────────────────────────────────────────────────────

/**
 * Multi-step signup wizard with animated slide transitions.
 * Step flow:
 *   - Buyers:  1 (AccountType) → 2 (UserInfo) → 3 (AccountInfo) → 4 (Confirmation)
 *   - Sellers: 1 (AccountType) → 2 (UserInfo) → 3 (AccountInfo) → 4 (ShopInfo) → 5 (Confirmation)
 *
 * On submit: creates Supabase auth user, inserts users row, and (for sellers) creates shop.
 * Navigates to OTP verification on success.
 */
export default function SignupScreen(): React.JSX.Element {
    const router = useRouter();
    const { theme } = useTheme();


    const {
        control,
        handleSubmit,
        watch,
        trigger,
        setValue,
        formState: { errors },
    } = useForm<SignupFormData>({
        defaultValues: {
            accountType: 'buyer',
            firstName: '',
            middleName: '',
            lastName: '',
            gender: 'male',
            dateOfBirth: '',
            email: '',
            password: '',
            confirmPassword: '',
            shopName: '',
            shopCountry: '',
            shopProvince: '',
            shopCity: '',
            shopBarangay: '',
            shopBlockLot: '',
            agreedToTerms: false,
        },
    });

    const watchAccountType: UserRole = watch('accountType');
    const watchPassword: string = watch('password');
    const watchEmail: string = watch('email');
    const isSeller = watchAccountType === 'seller';
    const totalSteps = isSeller ? TOTAL_SELLER_STEPS : TOTAL_BUYER_STEPS;

    const [stepIndex, setStepIndex] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);

    // Slide animation — translateX value
    const slideAnim = useRef(new RNAnimated.Value(0)).current;

    // ── Navigation ────────────────────────────────────────────────────────────

    /**
     * Drives the horizontal slide transition when stepIndex changes.
     */
    React.useEffect(() => {
        RNAnimated.timing(slideAnim, {
            toValue: -stepIndex * CONTENT_WIDTH,
            duration: Animation.DefaultAnimationSpeed || 350,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
        }).start();
    }, [stepIndex]);

    const handleNext = async (): Promise<void> => {
        const fields = getStepFields(stepIndex);
        if (fields.length > 0) {
            const valid = await trigger(fields);
            if (!valid) return;
        }

        // Email uniqueness check before moving from account info step
        if (stepIndex === 2) {
            setLoadingMessage('Checking email availability...');
            setIsLoading(true);
            const emailValid = await checkEmailUniqueness(watchEmail);
            setIsLoading(false);
            setLoadingMessage('');
            if (!emailValid) return;
        }

        setStepIndex((prev) => prev + 1);
    };

    const handleBack = (): void => {
        if (stepIndex === 0) {
            router.back();
            return;
        }
        setStepIndex((prev) => prev - 1);
    };

    /** Field groups to validate per step before advancing. */
    const getStepFields = (
        index: number
    ): (keyof SignupFormData)[] => {
        // Step 0: AccountType — no fields to re-validate (radio auto-advances)
        // Step 1: UserInfo
        // Step 2: AccountInfo
        // Step 3 (seller): SellerInfo
        // Final: Confirmation
        const sellerStepMap: (keyof SignupFormData)[][] = [
            [],
            ['firstName', 'lastName', 'gender', 'dateOfBirth'],
            ['email', 'password', 'confirmPassword'],
            ['shopName', 'shopCountry', 'shopProvince', 'shopCity', 'shopBarangay', 'shopBlockLot'],
            [],
        ];
        const buyerStepMap: (keyof SignupFormData)[][] = [
            [],
            ['firstName', 'lastName', 'gender', 'dateOfBirth'],
            ['email', 'password', 'confirmPassword'],
            [],
        ];
        const map = isSeller ? sellerStepMap : buyerStepMap;
        return map[index] ?? [];
    };



    /**
     * Checks whether the provided email already exists in the users table.
     * Use the check_email_availability RPC to bypass RLS.
     * Returns true if email is available, false (and shows alert) if taken.
     * If unconfirmed, redirects to verify-email and resends verification.
     */
    const checkEmailUniqueness = async (email: string): Promise<boolean> => {
        try {
            const { data, error } = await supabase.rpc('check_email_availability', { target_email: email });

            if (error) {
                console.warn('Network or DB error checking email uniqueness:', error.message || JSON.stringify(error));
                return true; // On network error, allow continue optimistically
            }

            if (data && data.available === false) {
                // Check if the existing user is unconfirmed
                const isConfirmed = data.is_confirmed;

                if (!isConfirmed) {
                    // Resend verification email
                    const { error: resendError } = await supabase.auth.resend({
                        type: 'signup',
                        email: email,
                        options: {
                            emailRedirectTo: 'moda://auth/login'
                        }
                    });

                    if (resendError) {
                        const resendErrorMessage = resendError.message || '';
                        if (
                            resendErrorMessage.includes(AUTH_EMAIL_SEND_FAILURE_FRAGMENT) ||
                            resendErrorMessage.includes(SMTP_AUTH_FAILURE_FRAGMENT)
                        ) {
                            Alert.alert(
                                'Email Service Temporarily Unavailable',
                                'We could not send a verification email right now. Please try again later while we restore email delivery.'
                            );
                            return false;
                        }
                    }

                    Alert.alert(
                        'Email Unconfirmed',
                        'An account with this email exists but is not yet confirmed. We have sent a new verification link to your inbox.',
                        [
                            {
                                text: 'OK',
                                onPress: () => router.replace({
                                    pathname: '/auth/verify-email',
                                    params: { email },
                                } as unknown as Parameters<typeof router.replace>[0]),
                            },
                        ]
                    );
                    return false;
                }

                // If already confirmed
                Alert.alert(
                    'Email Already Registered',
                    'An account with this email already exists. Please use a different email or log in.'
                );
                return false;
            }
            return true;
        } catch (err: unknown) {
            console.warn('Exception checking email uniqueness:', err);
            return true;
        }
    };

    // ── Submission ────────────────────────────────────────────────────────────

    /**
     * Handles the final signup submission:
     * 1. Calls Supabase Auth signUp — handles email confirmation flow
     * 2. Inserts a row in the users table
     * 3. (Seller) inserts a row in the shops table
     * On partial failure, partial records are cleaned up where possible.
     */
    const onSubmit = async (data: SignupFormData): Promise<void> => {
        if (!agreedToTerms) {
            Alert.alert('Terms Required', 'Please agree to the Terms & Conditions to continue.');
            return;
        }

        setLoadingMessage('Creating your account...');
        setIsLoading(true);

        // Step 1: Create Supabase Auth user with metadata
        // The public profile and (for sellers) the shop are now automatically
        // created by a database trigger (handle_new_user) to handle the 
        // unconfirmed session state correctly.
        const { error: authError } = await authApi.signUp(
            data.email,
            data.password,
            {
                account_type: data.accountType, // pass all data for the trigger
                first_name: data.firstName,
                middle_name: data.middleName || null,
                last_name: data.lastName,
                gender: data.gender,
                date_of_birth: data.dateOfBirth,
                role: data.accountType,
                // Shop data for the trigger
                shop_name: data.shopName,
                shop_country: data.shopCountry,
                shop_province: data.shopProvince,
                shop_city: data.shopCity,
                shop_address_detail: `${data.shopBlockLot}, ${data.shopBarangay}`,
            },
            'moda://auth/login'
        );

        if (authError) {
            setIsLoading(false);
            setLoadingMessage('');

            const errorMessage = authError.message || 'An unexpected error occurred. Please try again.';

            if (
                errorMessage.includes(AUTH_EMAIL_SEND_FAILURE_FRAGMENT) ||
                errorMessage.includes(SMTP_AUTH_FAILURE_FRAGMENT)
            ) {
                Alert.alert(
                    'Signup Temporarily Unavailable',
                    'Your account could not be created because verification email delivery failed. Please try again in a few minutes.'
                );
            } else if (errorMessage.includes('rate limit')) {
                Alert.alert(
                    'Rate Limit Exceeded',
                    'You have attempted to sign up too many times in a short period. Please wait a few minutes before trying again or check your email for an existing confirmation link.'
                );
            } else {
                Alert.alert('Signup Failed', errorMessage);
            }
            return;
        }

        setIsLoading(false);
        setLoadingMessage('');

        // Navigate to email verification status screen, passing the email
        // NOTE: Cast through unknown because expo-router typed routes may not include
        // newly added screen files until a full type regeneration is run.
        router.replace({
            pathname: '/auth/verify-email',
            params: { email: data.email },
        } as unknown as Parameters<typeof router.replace>[0]);
    };

    // ── Step Renderer ─────────────────────────────────────────────────────────

    /**
     * Renders all steps in a single row for horizontal sliding.
     */
    const getSteps = (): React.JSX.Element[] => {
        const buyerSteps = [
            <AccountTypeStep key="role" control={control} onNext={handleNext} />,
            <UserInfoStep key="user" control={control} errors={errors as any} />,
            <AccountInfoStep key="account" control={control} errors={errors as any} watchPassword={watchPassword} />,
            <ConfirmationStep
                key="confirm"
                data={watch()}
                control={control}
                agreedToTerms={agreedToTerms}
                onToggleTerms={() => setAgreedToTerms((prev) => !prev)}
                onViewTerms={() => Linking.openURL(TERMS_URL)}
            />
        ];

        if (!isSeller) return buyerSteps;

        // For sellers, insert Shop Info before Confirmation
        const sellerSteps = [...buyerSteps];
        sellerSteps.splice(3, 0, <SellerInfoStep key="shop" control={control} errors={errors as any} setValue={setValue} watch={watch} />);
        return sellerSteps;
    };

    const isLastStep = stepIndex === (isSeller ? TOTAL_SELLER_STEPS - 1 : TOTAL_BUYER_STEPS - 1);
    const isFirstStep = stepIndex === 0;

    // Progress bar display: step 0 doesn't show a numeric progress bar
    const progressStep = getStepNumber(stepIndex);

    return (
        <SafeScreen>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardAvoid}
            >
                <Animated.View
                    entering={Animation.Presets.FadeInDown}
                    exiting={Animation.Presets.FadeOutUp}
                    style={styles.container}
                >
                    {/* Header */}

                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <Text style={[styles.backButtonText, { color: theme.primary }]}>‹ Back</Text>
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Create Account</Text>
                        <View style={styles.backButton} />
                    </View>

                    {/* Progress bar (hide on step 0) */}
                    {stepIndex > 0 && (
                        <WizardProgressBar totalSteps={totalSteps - 1} currentStep={progressStep - 1} />
                    )}

                    {/* Animated step content */}
                    <View style={styles.stepContainer}>
                        <RNAnimated.View
                            style={[
                                styles.stepRow,
                                {
                                    width: totalSteps * CONTENT_WIDTH,
                                    transform: [{ translateX: slideAnim }]
                                }
                            ]}
                        >
                            {getSteps().map((step, idx) => (
                                <View key={idx} style={{ width: CONTENT_WIDTH }}>
                                    {step}
                                </View>
                            ))}
                        </RNAnimated.View>
                    </View>

                    {/* Navigation buttons (skip on step 0 — auto-advances) */}
                    {stepIndex > 0 && (
                        <View style={styles.navButtons}>
                            {isLastStep ? (
                                <TouchableOpacity
                                    style={[
                                        styles.primaryButton,
                                        { backgroundColor: theme.primary },
                                        !agreedToTerms && styles.primaryButtonDisabled,
                                    ]}
                                    onPress={handleSubmit(onSubmit)}
                                    disabled={!agreedToTerms || isLoading}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.primaryButtonText, { color: theme.white }]}>Create Account</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                                    onPress={handleNext}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.primaryButtonText, { color: theme.white }]}>Next →</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Sign In link */}
                    {isFirstStep && (
                        <View style={styles.loginLink}>
                            <Text style={[styles.loginLinkText, { color: theme.textSecondary }]}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => router.replace('/auth/login' as unknown as Parameters<typeof router.replace>[0])}>
                                <Text style={[styles.loginLinkAction, { color: theme.primary }]}>Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Loading Modal */}
                    <LoadingModal isVisible={isLoading} message={loadingMessage} />
                </Animated.View>
            </KeyboardAvoidingView>
        </SafeScreen>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    keyboardAvoid: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    backButton: {
        width: 60,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    stepContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    stepRow: {
        flex: 1,
        flexDirection: 'row',
    },
    navButtons: {
        paddingTop: 16,
    },
    primaryButton: {
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    primaryButtonDisabled: {
        opacity: 0.5,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    loginLink: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    loginLinkText: {
        fontSize: 14,
    },
    loginLinkAction: {
        fontSize: 14,
        fontWeight: '700',
    },
});
