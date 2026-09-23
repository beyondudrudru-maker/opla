// cleanDb.js
const cron = require('node-cron'); 
const { ramClient, coreClient } = require('./database/supabaseClient'); // 🚀 Reuse existing connections

async function flushBloatedMemory() {
    console.log(`\n[${new Date().toISOString()}] 🧹 Initiating Scheduled Deep Clean of Supabase Memory Banks...`);

    // 1. Flush the ephemeral chat_ram completely using ramClient
    if (ramClient) {
        const { error: ramErr } = await ramClient.from('chat_ram')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletes all rows safely
        
        if (ramErr) {
            console.error("❌ Error wiping chat_ram:", ramErr.message);
        } else {
            console.log("✅ chat_ram flushed successfully. (0 MB)");
        }
    } else {
        console.warn("⚠️ ramClient not found, skipping chat_ram flush.");
    }

    // 2. Flush all conversation_turns using coreClient
    if (coreClient) {
        const { error: turnErr } = await coreClient.from('conversation_turns')
            .delete()
            .neq('id', 0); // Deletes all rows
        
        if (turnErr) {
            console.error("❌ Error wiping conversation_turns:", turnErr.message);
        } else {
            console.log("✅ conversation_turns flushed successfully. (0 MB)");
        }
    } else {
        console.warn("⚠️ coreClient not found, skipping conversation_turns flush.");
    }

    console.log("🚀 Database deep clean complete! Awaiting next cycle.");
}

// 🚀 Schedule the task to run every 3 days at midnight (00:00)
cron.schedule('0 0 */3 * *', () => {
    console.log("⏰ Cron triggered: Running 3-day deep flush...");
    flushBloatedMemory();
});

console.log("⏳ Deep Clean Cron Service started. It will automatically run every 3 days at midnight.");
