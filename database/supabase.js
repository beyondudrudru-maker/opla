require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Tumhari .env file se keys utha raha hai
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL ya Key missing hai .env file mein!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧠 AI Database Connection Established successfully.');

module.exports = supabase;