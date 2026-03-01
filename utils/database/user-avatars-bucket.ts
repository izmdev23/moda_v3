import { supabase } from '../../supabase/supabaseClient';

export const userAvatarsBucket = {
  async upload(fileName: string, file: any) {
    return supabase.storage.from('user-avatars').upload(fileName, file);
  },
  getPublicUrl(fileName: string) {
    return supabase.storage.from('user-avatars').getPublicUrl(fileName);
  },
  async delete(fileNames: string[]) {
    return supabase.storage.from('user-avatars').remove(fileNames);
  }
};
