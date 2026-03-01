import { supabase } from '../../supabase/supabaseClient';

export const productThumbnailsBucket = {
  async upload(fileName: string, file: any) {
    return supabase.storage.from('product-thumbnails').upload(fileName, file);
  },
  getPublicUrl(fileName: string) {
    return supabase.storage.from('product-thumbnails').getPublicUrl(fileName);
  },
  async delete(fileNames: string[]) {
    return supabase.storage.from('product-thumbnails').remove(fileNames);
  }
};
