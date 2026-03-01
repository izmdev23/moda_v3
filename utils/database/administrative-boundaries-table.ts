import { supabase } from '../../supabase/supabaseClient';
import { BoundaryItem } from '../types';
import { BaseApi } from './api';

/**
 * API layer for the 'administrative_boundaries' table.
 */
export class AdministrativeBoundariesApi extends BaseApi<'administrative_boundaries'> {
  constructor() {
    super('administrative_boundaries');
  }

  /**
   * Fetches the root level (level 0) administrative boundaries.
   */
  async getRoot(): Promise<BoundaryItem[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('id, name')
      .eq('level', 0)
      .is('parent_id', null)
      .order('name');

    if (error) return [];
    return (data ?? []).map((d) => ({ id: d.id, name: d.name }));
  }

  /**
   * Fetches administrative boundaries by level and parent ID.
   */
  async getByParent(level: number, parentId: number): Promise<BoundaryItem[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('id, name')
      .eq('level', level)
      .eq('parent_id', parentId)
      .order('name');

    if (error) return [];
    return (data ?? []).map((d) => ({ id: d.id, name: d.name }));
  }
}

export const administrativeBoundariesTable: AdministrativeBoundariesApi = new AdministrativeBoundariesApi();
