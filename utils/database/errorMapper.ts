/**
 * Maps Supabase Postgres error codes to user-friendly messages.
 * @param code The error code returned by Supabase/Postgrest.
 * @returns A descriptive error message string.
 */
export function mapSupabaseError(code: string): string {
  switch (code) {
    case '23505':
      return 'Unique constraint violation. A record with this data already exists.';
    case '23503':
      return 'Foreign key violation. The referenced record does not exist.';
    case '42P01':
      return 'Table does not exist.';
    case 'PGRST116':
      return 'The requested record was not found.';
    default:
      return 'An unexpected database error occurred. Please try again later.';
  }
}
