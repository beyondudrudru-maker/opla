/**
 * decision/targetResolver.js
 *
 * PURPOSE
 *   Figures out who a message is actually *about*, not just who sent it.
 *   Without this, ambiguous references ("roast wizard", "what did machli
 *   say") default to Melody assuming she's the subject — this makes that
 *   an explicit, resolved decision instead of a silent guess.
 *
 * INPUTS
 *   { mentions: { everyone: boolean, users: [{ id, username }] }, botUserId }
 *
 * OUTPUTS
 *   { addressingEveryone, targets: [{ id, name, mentionTag }], hasThirdPartyTarget }
 *
 * 🛡️ FIX: Synchronized property mapping (`u.username`) to match the new 
 * multi-target scanner output from index.js.
 */

function resolve({ mentions = { everyone: false, users: [] }, botUserId }) {
  const others = (mentions.users || [])
    .filter((u) => u.id !== botUserId)
    .map((u) => ({ 
        id: u.id, 
        // Safely catch the username from the index.js payload, with fallbacks
        name: u.username || u.name || 'User', 
        mentionTag: `<@${u.id}>` 
    }));

  return {
    addressingEveryone: !!mentions.everyone,
    targets: others,
    hasThirdPartyTarget: others.length > 0,
  };
}

module.exports = { resolve };
