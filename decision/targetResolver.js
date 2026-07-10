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
 *   { mentions: { everyone: boolean, users: [{ id, name }] }, botUserId }
 *
 * OUTPUTS
 *   { addressingEveryone, targets: [{ id, name }], hasThirdPartyTarget }
 */

function resolve({ mentions = { everyone: false, users: [] }, botUserId }) {
  const others = (mentions.users || []).filter((u) => u.id !== botUserId);

  return {
    addressingEveryone: !!mentions.everyone,
    targets: others,
    hasThirdPartyTarget: others.length > 0,
  };
}

module.exports = { resolve };