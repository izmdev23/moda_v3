import { supabase } from '../../supabase/supabaseClient';

export const reviewImagesBucket = {
  async upload(fileName: string, file: any) {
    return supabase.storage.from('review-images').upload(fileName, file);
  },
  getPublicUrl(fileName: string) {
    return supabase.storage.from('review-images').getPublicUrl(fileName);
  },
  async delete(fileNames: string[]) {
    return supabase.storage.from('review-images').remove(fileNames);
  }
};
