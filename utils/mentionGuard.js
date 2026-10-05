// utils/mentionGuard.js
// Fixes the "@GARV @GARV How are you?" double-tag bug.
// Rule: every target user ends up tagged EXACTLY ONCE.
//   - AI already wrote <@id>            -> keep it, do NOT prepend again
//   - AI wrote the plain name/@name     -> convert that occurrence into <@id> (real ping, no duplicate)
//   - AI never mentioned them           -> prepend <@id>
'use strict';

function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function plainName(str) {
    return String(str || '')
        .toLowerCase()
        .replace(/[!|\[\(].*?[\]\)]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function candidateNames(u, guild) {
    const member = guild?.members?.cache?.get(String(u.id));
    const raw = [
        u.username,
        member?.displayName,
        member?.user?.username,
        u.matchedName,
        plainName(u.matchedName)
    ];
    const names = new Set();
    raw.forEach(n => {
        const t = String(n || '').trim();
        if (t.length >= 3) names.add(t);
    });
    // longest first so "garv gaming" is tried before "garv"
    return [...names].sort((a, b) => b.length - a.length);
}

function ensureSingleMention(text, users = [], guild = null) {
    let out = String(text || '');
    const missing = [];

    for (const u of users) {
        const id = String(u.id);
        const names = candidateNames(u, guild);
        const tagRe = new RegExp(`<@!?${id}>`);

        if (!tagRe.test(out)) {
            let converted = false;
            for (const name of names) {
                const nameRe = new RegExp(`(^|[^\\w<@])@?${escapeRegExp(name)}(?![\\w>])`, 'i');
                if (nameRe.test(out)) {
                    out = out.replace(nameRe, (_, pre) => `${pre}<@${id}>`);
                    converted = true;
                    break;
                }
            }
            if (!converted) {
                missing.push(`<@${id}>`);
                continue;
            }
        }

        // collapse "<@id> <@id>" and "<@id> @name" into a single tag
        const nameAlt = names.map(escapeRegExp).join('|');
        const dupRe = new RegExp(
            `(<@!?${id}>)(?:\\s*(?:<@!?${id}>${nameAlt ? `|@(?:${nameAlt})(?![\\w>])` : ''}))+`,
            'gi'
        );
        out = out.replace(dupRe, '$1');
    }

    return missing.length ? `${missing.join(' ')} ${out}`.trim() : out;
}

// Cheap generic guard for replies where we never prepend (e.g. normal AI chat)
function collapseDuplicateMentions(text) {
    return String(text || '').replace(/(<@!?(\d+)>)(?:\s*<@!?\2>)+/g, '$1');
}

module.exports = { ensureSingleMention, collapseDuplicateMentions };
