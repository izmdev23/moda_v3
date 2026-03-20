import { Tables } from '../../supabase/database.types';
import { supabase } from '../../supabase/supabaseClient';
import { DatabaseResult } from '../../supabase/types';
import { BaseApi } from './api';

/**
 * API layer for the 'products' table.
 */
export class ProductsApi extends BaseApi<'products'> {
  constructor() {
    super('products');
  }

  /**
   * Performs a full-text search on products using the search vector.
   */
  async search(query: string, offset: number = 0, limit: number = 10): Promise<DatabaseResult<Tables<'products'>[]>> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .textSearch('search_vector' as any, query)
      .range(offset, offset + limit - 1);

    return { data: data as Tables<'products'>[] | null, error };
  }
  /**
   * Fetches all products given a shop ID.
   */
  async getByShopId(shopId: number): Promise<DatabaseResult<Tables<'products'>[]>> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id' as any, shopId);

    return { data: data as Tables<'products'>[] | null, error };
  }
  /**
   * Fetches products with specific filters (category, price range).
   */
  async getFiltered(filters: { category?: string; minPrice?: number; maxPrice?: number }): Promise<DatabaseResult<Tables<'products'>[]>> {
    let query = supabase.from('products').select('*');

    if (filters.category) {
      query = (query as any).eq('category', filters.category);
    }

    const { data, error } = await (query as any);
    return { data: data as Tables<'products'>[] | null, error };
  }
}

export const productsTable: ProductsApi = new ProductsApi();
