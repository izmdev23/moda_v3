import { supabase } from '../../supabase/supabaseClient';

export const productImagesBucket = {
  async upload(fileName: string, file: any) {
    return supabase.storage.from('product-images').upload(fileName, file);
  },
  getPublicUrl(fileName: string) {
    return supabase.storage.from('product-images').getPublicUrl(fileName);
  },
  async delete(fileNames: string[]) {
    return supabase.storage.from('product-images').remove(fileNames);
  }
};
