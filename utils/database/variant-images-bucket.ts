import { supabase } from '../../supabase/supabaseClient';

export const variantImagesBucket = {
  async upload(fileName: string, file: any) {
    return supabase.storage.from('variant-images').upload(fileName, file);
  },
  getPublicUrl(fileName: string) {
    return supabase.storage.from('variant-images').getPublicUrl(fileName);
  },
  async delete(fileNames: string[]) {
    return supabase.storage.from('variant-images').remove(fileNames);
  }
};
