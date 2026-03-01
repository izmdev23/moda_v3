import { supabase } from '../../supabase/supabaseClient';

/**
 * Generic helper for storage bucket operations.
 */
class BucketApi {
    private bucketName: string;

    constructor(bucketName: string) {
        this.bucketName = bucketName;
    }

    /**
     * Uploads a file to the bucket.
     */
    async upload(fileName: string, file: any): Promise<{ data: any; error: any }> {
        return await supabase.storage.from(this.bucketName).upload(fileName, file);
    }

    /**
     * Retrieves the public URL for a given file.
     */
    getPublicUrl(fileName: string): { data: { publicUrl: string } } {
        return supabase.storage.from(this.bucketName).getPublicUrl(fileName);
    }

    /**
     * Removes files from the bucket.
     */
    async delete(fileNames: string[]): Promise<{ data: any; error: any }> {
        return await supabase.storage.from(this.bucketName).remove(fileNames);
    }
}

export const productImagesBucket: BucketApi = new BucketApi('product-images');
export const productThumbnailsBucket: BucketApi = new BucketApi('product-thumbnails');
export const variantImagesBucket: BucketApi = new BucketApi('variant-images');
export const userAvatarsBucket: BucketApi = new BucketApi('user-avatars');
export const vtonResultsBucket: BucketApi = new BucketApi('vton-results');
export const reviewImagesBucket: BucketApi = new BucketApi('review-images');
export const chatImagesBucket: BucketApi = new BucketApi('chat-images');
