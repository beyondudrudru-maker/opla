// utils/replyChunked.js
'use strict';

function splitText(text, limit = 1900) {
    const out = [];
    let rest = String(text || '').trim();
    while (rest.length > limit) {
        let cut = rest.lastIndexOf('\n', limit);
        if (cut < limit * 0.5) cut = rest.lastIndexOf(' ', limit);
        if (cut < limit * 0.5) cut = limit;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out;
}

async function replyChunked(message, text, allowedMentions = { parse: [], repliedUser: false }) {
    const chunks = splitText(text);
    for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
            await message.reply({ content: chunks[i], allowedMentions });
        } else {
            await new Promise(r => setTimeout(r, 600));
            await message.channel.send({ content: chunks[i], allowedMentions: { parse: allowedMentions.parse || [] } });
        }
    }
}

module.exports = { replyChunked, splitText };
