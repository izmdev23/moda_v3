import { supabase } from '../../supabase/supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max allowed file size for VTON user photos (5 MB). */
const MAX_VTON_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

/** Max time to read a local URI before aborting (30s). */
const LOCAL_URI_READ_TIMEOUT_MS = 30000;

/** Supported mime types for VTON user photos. */
const ALLOWED_VTON_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Reads a local image URI into a Blob using XMLHttpRequest.
 * More reliable than fetch(uri) for Android `content://` and `file://` URIs.
 */
const readLocalUriAsBlob = async (fileUri: string): Promise<Blob> => {
    return await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.onerror = () => {
            reject(new Error('Unable to read the selected image. Please choose a different photo and try again.'));
        };

        xhr.ontimeout = () => {
            reject(new Error('Reading the selected image timed out. Please choose a different photo and try again.'));
        };

        xhr.onload = () => {
            const response = xhr.response;
            if (response instanceof Blob) {
                resolve(response);
                return;
            }
            reject(new Error('Unable to process the selected image.'));
        };

        xhr.responseType = 'blob';
        xhr.timeout = LOCAL_URI_READ_TIMEOUT_MS;
        xhr.open('GET', fileUri, true);
        xhr.send();
    });
};

/**
 * Converts a Blob to an ArrayBuffer via FileReader.
 * Necessary for React Native: XHR-created Blobs cannot be passed directly to
 * the Supabase Storage SDK's internal fetch call (results in "Network request
 * failed"), but ArrayBuffer works reliably.
 */
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
    new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { resolve(reader.result as ArrayBuffer); };
        reader.onerror = () => { reject(reader.error ?? new Error('Failed to convert image for upload.')); };
        reader.readAsArrayBuffer(blob);
    });

// ─── vton-results ─────────────────────────────────────────────────────────────

/**
 * Storage helpers for the `vton-results` bucket.
 * Stores AI-generated try-on output images.
 */
export const vtonResultsBucket = {
    /** Returns the public URL for a result image. */
    getPublicUrl(fileName: string): string {
        const { data } = supabase.storage.from('vton-results').getPublicUrl(fileName);
        return data.publicUrl;
    },

    /** Deletes result images by file path. */
    async delete(filePaths: string[]): Promise<void> {
        await supabase.storage.from('vton-results').remove(filePaths);
    },
};

// ─── vton-user-photos ─────────────────────────────────────────────────────────

/**
 * Storage helpers for the `vton-user-photos` bucket.
 * Stores user-uploaded photos used as try-on input.
 *
 * WARNING: Photos uploaded here are used as the "human_img" input to Replicate.
 * Validate image type and size client-side before calling upload().
 *
 * @example Correct usage:
 *   const { url } = await vtonUserPhotosBucket.upload('user123/photo.jpg', fileUri, 'image/jpeg');
 * @example Incorrect usage:
 *   Do NOT upload if size > MAX_VTON_PHOTO_SIZE_BYTES or type is not jpg/png/webp.
 */
export const vtonUserPhotosBucket = {
    /**
     * Validates and uploads a user photo for virtual try-on.
     * Returns the public URL on success, or throws on validation/upload failure.
     */
    async upload(
        path: string,
        fileUri: string,
        mimeType: string,
    ): Promise<{ publicUrl: string }> {
        const normalizedMimeType = mimeType.toLowerCase();
        if (!ALLOWED_VTON_MIME_TYPES.includes(normalizedMimeType)) {
            throw new Error('Invalid file type. Please use JPG, PNG, or WEBP.');
        }

        // Read blob from local URI (Android content URIs can fail with fetch).
        const blob = await readLocalUriAsBlob(fileUri);

        if (blob.size > MAX_VTON_PHOTO_SIZE_BYTES) {
            throw new Error('File too large. Maximum size is 5 MB.');
        }

        // Convert Blob → ArrayBuffer so Supabase SDK's internal fetch can send it.
        // Passing a Blob directly causes "StorageUnknownError: Network request failed"
        // in React Native because XHR-created Blobs aren't consumable by native fetch.
        const arrayBuffer = await blobToArrayBuffer(blob);

        const { error } = await supabase.storage
            .from('vton-user-photos')
            .upload(path, arrayBuffer, { contentType: normalizedMimeType, upsert: true });

        if (error) {
            console.error('[vton-upload] Storage upload failed:', {
                message: error.message,
                name: (error as { name?: string }).name,
                statusCode: (error as { statusCode?: string }).statusCode,
                cause: (error as { cause?: unknown }).cause,
            });
            throw new Error(`Upload failed: ${error.message}`);
        }

        const { data } = supabase.storage.from('vton-user-photos').getPublicUrl(path);
        return { publicUrl: data.publicUrl };
    },

    /** Deletes user photos by file path. */
    async delete(filePaths: string[]): Promise<void> {
        await supabase.storage.from('vton-user-photos').remove(filePaths);
    },
};

// Legacy export preserved for backward compatibility
export const vtonBucket = vtonResultsBucket;

