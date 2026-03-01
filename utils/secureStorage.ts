import * as SecureStore from 'expo-secure-store';
import { decryptData } from './utils';

const MAX_CHUNK_SIZE = 2000; // SecureStore has a 2048-byte limit on some platforms
const CHUNK_PREFIX = '__CHUNKED__:';

/**
 * Removes all chunks associated with a specific key.
 * @param key The base key to clean up chunks for.
 */
const cleanupChunks = async (key: string): Promise<void> => {
    let i = 0;
    while (true) {
        const chunkKey = `${key}_chunk_${i}`;
        const exists = await SecureStore.getItemAsync(chunkKey);
        if (!exists) break;
        await SecureStore.deleteItemAsync(chunkKey);
        i++;
    }
};

/**
 * Saves a string value securely, automatically splitting into chunks if it exceeds the limit.
 * Optimized by removing redundant manual encryption as SecureStore is natively encrypted.
 */
export const setSecureItem = async (key: string, value: string): Promise<boolean> => {
    try {
        // Clean up any existing chunks first to avoid stale data
        await cleanupChunks(key);

        if (value.length <= MAX_CHUNK_SIZE) {
            await SecureStore.setItemAsync(key, value);
        } else {
            const numChunks = Math.ceil(value.length / MAX_CHUNK_SIZE);
            for (let i = 0; i < numChunks; i++) {
                const chunk = value.substring(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE);
                await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
            }
            // Store metadata to indicate chunking
            await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${numChunks}`);
        }
        return true;
    } catch (e) {
        console.error('Failed to save secure item:', e);
        return false;
    }
};

/**
 * Retrieves a securely stored value, joining chunks if necessary.
 * Provides a fallback for old manual-encrypted values.
 */
export const getSecureItem = async (key: string): Promise<string | null> => {
    try {
        const value = await SecureStore.getItemAsync(key);
        if (!value) return null;

        // Handle chunked data
        if (value.startsWith(CHUNK_PREFIX)) {
            const numChunks = parseInt(value.replace(CHUNK_PREFIX, ''), 10);
            let joined = '';
            for (let i = 0; i < numChunks; i++) {
                const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
                if (chunk) joined += chunk;
            }
            return joined;
        }

        // Compatibility fallback: Check if it's an old encrypted value (standard AES starts with "U2FsdGVk")
        // and try to decrypt if it doesn't look like plain JSON.
        if (value.startsWith('U2FsdGVk')) {
            try {
                const decrypted = decryptData(value);
                if (decrypted) return decrypted;
            } catch {
                // If decryption fails, just return the raw value
            }
        }

        return value;
    } catch (e) {
        console.error('Failed to retrieve secure item:', e);
        return null;
    }
};

/**
 * Removes a securely stored value and all its chunks.
 */
export const removeSecureItem = async (key: string): Promise<boolean> => {
    try {
        await cleanupChunks(key);
        await SecureStore.deleteItemAsync(key);
        return true;
    } catch (e) {
        console.error('Failed to remove secure item:', e);
        return false;
    }
};

