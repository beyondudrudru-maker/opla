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
 *   { addressingEveryone, targets: [{ id, name, mentionTag }], hasThirdPartyTarget }
 *
 * CHANGELOG
 *   v2: targets now carry a pre-formatted `mentionTag` (<@id>) so the
 *   prompt can instruct the model to drop in a real, working Discord
 *   ping verbatim instead of inferring formatting from a display name.
 */

function resolve({ mentions = { everyone: false, users: [] }, botUserId }) {
  const others = (mentions.users || [])
    .filter((u) => u.id !== botUserId)
    .map((u) => ({ id: u.id, name: u.name, mentionTag: `<@${u.id}>` }));

  return {
    addressingEveryone: !!mentions.everyone,
    targets: others,
    hasThirdPartyTarget: others.length > 0,
  };
}

module.exports = { resolve };