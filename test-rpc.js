const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.rpc('check_email_availability', { target_email: '' });
    console.log('Data:', data);
    console.log('Error:', error);
}

run();
