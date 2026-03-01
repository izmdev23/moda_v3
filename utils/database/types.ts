import { DatabaseResult, Tables } from '../../supabase/types';

export type { DatabaseResult, Tables };

export interface PaginationParams {
    offset: number;
    limit: number;
}
