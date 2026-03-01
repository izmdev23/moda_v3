import { supabase } from '../../supabase/supabaseClient';

export const chatImagesBucket = {
  async upload(fileName: string, file: any) {
    return supabase.storage.from('chat-images').upload(fileName, file);
  },
  getPublicUrl(fileName: string) {
    return supabase.storage.from('chat-images').getPublicUrl(fileName);
  },
  async delete(fileNames: string[]) {
    return supabase.storage.from('chat-images').remove(fileNames);
  }
};
