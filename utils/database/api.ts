import { Database, Tables, TablesInsert, TablesUpdate } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { DatabaseResult } from '../../supabase/types';

/**
 * Filter for tables that contain a 'uid' column of type string.
 */
export type TableWithUid = {
  [K in keyof Database['public']['Tables']]: Database['public']['Tables'][K]['Row'] extends { uid: string } ? K : never
}[keyof Database['public']['Tables']];

/**
 * Filter for tables that contain an 'id' column of type number.
 */
export type TableWithId = {
  [K in keyof Database['public']['Tables']]: Database['public']['Tables'][K]['Row'] extends { id: number } ? K : never
}[keyof Database['public']['Tables']];

/**
 * Filter for tables that contain a 'deleted_at' column for soft deletes.
 */
export type TableWithDeletedAt = {
  [K in keyof Database['public']['Tables']]: Database['public']['Tables'][K]['Row'] extends { deleted_at: string | null } ? K : never
}[keyof Database['public']['Tables']];

/**
 * Base class for all Database API operations.
 * Dynamically infers types from the auto-generated Supabase schema.
 * 
 * @template T - The table name from the Database schema.
 */
export class BaseApi<T extends keyof Database['public']['Tables']> {
  protected tableName: T;

  constructor(tableName: T) {
    this.tableName = tableName;
  }

  /**
   * Fetches a single record by its internal numeric ID.
   * This method is only available for tables that have an 'id' column.
   * 
   * @param id - The numeric primary key of the record.
   * @returns A promise resolving to the database result containing the record.
   */
  async getById(this: BaseApi<T & TableWithId>, id: number): Promise<DatabaseResult<Tables<T>>> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id' as any, id)
      .single();

    return { data: data as Tables<T> | null, error: error };
  }

  /**
   * Fetches a single record by its public UID.
   * This method is only available for tables that have a 'uid' column.
   * 
   * @param uid - The public unique identifier of the record.
   * @returns A promise resolving to the database result containing the record.
   */
  async getByUid(this: BaseApi<T & TableWithUid>, uid: string): Promise<DatabaseResult<Tables<T>>> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('uid' as any, uid)
      .single();

    return { data: data as Tables<T> | null, error: error };
  }

  /**
   * Fetches multiple records with pagination.
   * 
   * @param offset - The starting index for pagination.
   * @param limit - The maximum number of records to fetch.
   * @returns A promise resolving to the database result containing the array of records.
   */
  async getAll(offset: number = 0, limit: number = 10): Promise<DatabaseResult<Tables<T>[]>> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .range(offset, offset + limit - 1);

    return { data: data as Tables<T>[] | null, error: error };
  }

  /**
   * Creates a new record in the table with strictly typed payload.
   * 
   * @param payload - The data to insert, conforming to the table's Insert type.
   * @returns A promise resolving to the database result containing the created record.
   */
  async create(payload: TablesInsert<T>): Promise<DatabaseResult<Tables<T>>> {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(payload as any)
      .select()
      .single();

    return { data: data as Tables<T> | null, error: error };
  }

  /**
   * Updates an existing record with strictly typed payload.
   * This method uses the public UID as the identifier.
   * 
   * @param uid - The public UID of the record to update.
   * @param payload - The data to update, conforming to the table's Update type.
   * @returns A promise resolving to the database result containing the updated record.
   */
  async update(this: BaseApi<T & TableWithUid>, uid: string, payload: TablesUpdate<T>): Promise<DatabaseResult<Tables<T>>> {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(payload as any)
      .eq('uid' as any, uid)
      .select()
      .single();

    return { data: data as Tables<T> | null, error: error };
  }

  /**
   * Performs a soft delete by setting a deleted_at timestamp.
   * This method is only available for tables that have a 'deleted_at' column and 'uid' column.
   * 
   * WARNING: This function can break the project if misused on a table without a 'deleted_at' column.
   * Ensure the table schema includes a 'deleted_at' timestamp before calling this.
   * 
   * @param uid - The public UID of the record to soft delete.
   * @returns A promise resolving to the database result containing the soft-deleted record.
   */
  async softDelete(this: BaseApi<T & TableWithUid & TableWithDeletedAt>, uid: string): Promise<DatabaseResult<Tables<T>>> {
    const { data, error } = await supabase
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('uid' as any, uid)
      .select()
      .single();

    return { data: data as Tables<T> | null, error: error };
  }

  /**
   * Hard deletes a record from the database.
   * This method is only available for tables that have a 'uid' column.
   * 
   * WARNING: This action is permanent and cannot be undone. Always confirm with the user.
   * 
   * @param uid - The public UID of the record to hard delete.
   * @returns A promise resolving to the database result containing the deleted record.
   */
  async delete(this: BaseApi<T & TableWithUid>, uid: string): Promise<DatabaseResult<Tables<T>>> {
    const { data, error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('uid' as any, uid)
      .select()
      .single();

    return { data: data as Tables<T> | null, error: error };
  }
}
