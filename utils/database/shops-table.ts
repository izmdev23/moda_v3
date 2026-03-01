import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { DatabaseResult } from '../../supabase/types';
import { BaseApi } from './api';

/**
 * API layer for the 'shops' table.
 */
export class ShopsApi extends BaseApi<'shops'> {
  constructor() {
    super('shops');
  }

  /**
   * Fetches a shop by the user ID of the owner.
   * 
   * @param userId - The numeric ID of the user who owns the shop.
   * @returns A promise resolving to the database result containing the shop record.
   */
  async getByUserId(userId: number): Promise<DatabaseResult<Tables<'shops'>>> {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', userId)
      .single();

    return { data: data as Tables<'shops'> | null, error };
  }

  /**
   * Performs a full-text search on shop names.
   * 
   * @param query - The search string to match against shop names.
   * @returns A promise resolving to the database result containing an array of matched shop records.
   */
  async search(query: string): Promise<DatabaseResult<Tables<'shops'>[]>> {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .textSearch('shop_name', query);

    return { data: data as Tables<'shops'>[] | null, error };
  }
}

export const shopsTable: ShopsApi = new ShopsApi();
