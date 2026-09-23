// cleanDb.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron'); // 🚀 NEW: Import node-cron for scheduling

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function flushBloatedMemory() {
    console.log(`\n[${new Date().toISOString()}] 🧹 Initiating Scheduled Deep Clean of Supabase Memory Banks...`);

    // 1. Flush the ephemeral chat_ram completely
    const { error: ramErr } = await supabase.from('chat_ram')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletes all rows safely
    
    if (ramErr) {
        console.error("❌ Error wiping chat_ram:", ramErr.message);
    } else {
        console.log("✅ chat_ram flushed successfully. (0 MB)");
    }

    // 2. Flush all conversation_turns from the core DB
    const { error: turnErr } = await supabase.from('conversation_turns')
        .delete()
        .neq('id', 0); // Deletes all rows
    
    if (turnErr) {
        console.error("❌ Error wiping conversation_turns:", turnErr.message);
    } else {
        console.log("✅ conversation_turns flushed successfully. (0 MB)");
    }

    console.log("🚀 Database deep clean complete! Awaiting next cycle.");
}

// 🚀 UPGRADE: Schedule the task to run every 3 days at midnight (00:00)
// Cron format: 'Minute Hour DayOfMonth Month DayOfWeek'
cron.schedule('0 0 */3 * *', () => {
    console.log("⏰ Cron triggered: Running 3-day deep flush...");
    flushBloatedMemory();
});

console.log("⏳ Deep Clean Cron Service started. It will automatically run every 3 days at midnight.");

// Optional: Run it once immediately when you start the script, uncomment the line below:
 flushBloatedMemory();
