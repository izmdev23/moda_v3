import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { DatabaseResult } from '../../supabase/types';
import { BaseApi } from './api';

/**
 * API layer for the 'users' table.
 */
export class UsersApi extends BaseApi<'users'> {
  constructor() {
    super('users');
  }

  /**
   * Fetches a user by their Auth ID.
   * 
   * @param authId - The ID from Supabase Auth (UUID).
   * @returns A promise resolving to the database result containing the user record.
   */
  async getByAuthId(authId: string): Promise<DatabaseResult<Tables<'users'>>> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();

    return { data: data as Tables<'users'> | null, error };
  }
}

export const usersTable: UsersApi = new UsersApi();
