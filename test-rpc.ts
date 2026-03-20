import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);
async function run() {
    const { data, error } = await supabase.rpc('check_email_availability', { target_email: 'test@example.com' });
    console.log('Data:', data);
    console.log('Error:', error);
}

run();
