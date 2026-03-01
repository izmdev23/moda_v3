import CryptoJS from 'crypto-js';
import Constants from 'expo-constants';

// Password Validation Helper
// Minimum 8 characters, at least one uppercase, at least one lowercase, at least one number
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Minimum of 8 characters');
    if (!/[a-z]/.test(password)) errors.push('At least one lowercase');
    if (!/[A-Z]/.test(password)) errors.push('At least one uppercase');
    if (!/[0-9]/.test(password)) errors.push('At least one number');

    return {
        isValid: errors.length === 0,
        errors,
    };
};

// SHA256 Hashing (Verification only, NOT encryption as per guidelines)
export const hashString = (text: string): string => {
    return CryptoJS.SHA256(text).toString();
};

// Price Formatters
export const formatPrice = (amount: number): string => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPriceRange = (min: number, max: number): string => {
    if (min === max) {
        return formatPrice(min);
    }
    return `₱${min.toLocaleString('en-PH')} - ₱${max.toLocaleString('en-PH')}`;
};

// Date Formatters
export const formatDate = (date: string | Date | number): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

export const formatFullDateTime = (date: string | Date | number): string => {
    const d = new Date(date);
    return d.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

// Discount Calculator
export const calculateDiscount = (original: number, sale: number): number => {
    if (original <= 0) return 0;
    return Math.round(((original - sale) / original) * 100);
};

// AES-256 Encryption / Decryption
const SECRET_KEY = Constants.expoConfig?.extra?.secureStorageKey || 'MODA_FALLBACK_SECURE_KEY_WXYZ';

export const encryptData = (data: string): string => {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
};

export const decryptData = (ciphertext: string): string => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
};
