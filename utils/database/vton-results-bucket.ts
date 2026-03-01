import { supabase } from '../../supabase/supabaseClient';

export const vtonBucket = {
  async upload(fileName: string, file: any) {
    return supabase.storage.from('vton-results').upload(fileName, file);
  },
  getPublicUrl(fileName: string) {
    return supabase.storage.from('vton-results').getPublicUrl(fileName);
  },
  async delete(fileNames: string[]) {
    return supabase.storage.from('vton-results').remove(fileNames);
  }
};
