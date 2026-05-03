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

export type InventoryStockState = 'in-stock' | 'low-stock' | 'sold-out';

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export const getInventoryStockState = (
    stock: number,
    lowStockThreshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
): InventoryStockState => {
    if (stock <= 0) {
        return 'sold-out';
    }

    if (stock <= lowStockThreshold) {
        return 'low-stock';
    }

    return 'in-stock';
};

export const getInventoryStockLabel = (
    stock: number,
    lowStockThreshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
): 'In Stock' | 'Low Stock' | 'Sold Out' => {
    const state = getInventoryStockState(stock, lowStockThreshold);

    if (state === 'sold-out') {
        return 'Sold Out';
    }

    if (state === 'low-stock') {
        return 'Low Stock';
    }

    return 'In Stock';
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

/**
 * Extracts and logs detailed information about an error, including the function, file, and line number.
 * Ensures an organized print block for debugging purposes.
 * 
 * @param error - The error object caught in a try/catch block.
 * @param context - Optional string providing context about where the error was caught.
 * 
 * @example
 * // Correct Usage:
 * try {
 *   throw new Error("Something failed");
 * } catch (error) {
 *   logError(error, "Failed during fetch");
 * }
 */
export const logError = (error: unknown, context?: string): void => {
    let errorMessage = 'Unknown Error';
    let functionName = 'Unknown';
    let filePath = 'Unknown';
    let lineNumber = 'Unknown';

    if (error instanceof Error) {
        errorMessage = error.message;

        if (error.stack) {
            const stackLines = error.stack.split('\n');
            const targetLine = stackLines[1] || stackLines[0]; // Usually the second line has the exact caller info

            if (targetLine) {
                // Match Node/V8 style: "at FunctionName (path/to/file:line:col)"
                const fullMatch = targetLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
                // Match Node/V8 minimal style: "at path/to/file:line:col"
                const fileMatch = targetLine.match(/at\s+(.*):(\d+):(\d+)/);
                // Match React Native / Safari style: "FunctionName@path/to/file:line:col"
                const rnMatch = targetLine.match(/(.*)@(.*):(\d+):(\d+)/);

                if (fullMatch && fullMatch.length === 5) {
                    functionName = fullMatch[1].trim();
                    filePath = fullMatch[2].trim();
                    lineNumber = fullMatch[3].trim();
                } else if (rnMatch && rnMatch.length === 5) {
                    functionName = rnMatch[1].trim() || 'Anonymous';
                    filePath = rnMatch[2].trim();
                    lineNumber = rnMatch[3].trim();
                } else if (fileMatch && fileMatch.length === 4) {
                    functionName = '<anonymous>';
                    filePath = fileMatch[1].trim();
                    lineNumber = fileMatch[2].trim();
                }
            }
        }
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        try {
            errorMessage = JSON.stringify(error);
        } catch (_) {
            errorMessage = "Unparseable Error Object";
        }
    }

    // Format output
    const output = [
        "",
        "================================================",
        "🚨 ERROR LOG",
        "================================================",
        `Message:  ${context ? `[${context}] ` : ''}${errorMessage}`,
        `Function: ${functionName}`,
        `File:     ${filePath}`,
        `Line:     ${lineNumber}`,
        "================================================",
        ""
    ].join('\n');

    console.error(output);
};
