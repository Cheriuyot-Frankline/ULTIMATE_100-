const TIMEOUT_MS = 10000;

async function getJson(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

module.exports = async function handleExtras({
    command, args, reply, sock, m, remoteJid, BOT_NAME, OWNER_NAME, getOwnerJid
}) {
    // ───────── 👑 OWNER ─────────
    if (command === 'owner' || command === 'creator') {
        const jid = getOwnerJid();
        const number = jid ? jid.split('@')[0] : 'Unknown';

        const card =
            `╔═══════════════════════════╗\n` +
            `║   👑 *BOT OWNER*   👑\n` +
            `╚═══════════════════════════╝\n\n` +
            `┏━━━━━━━━━━━━━━━━━━━━━┓\n` +
            `┃ 👤 *Name:*  ${OWNER_NAME}\n` +
            `┃ 📞 *Number:* wa.me/${number}\n` +
            `┃ 🤖 *Bot:*   ${BOT_NAME}\n` +
            `┃ 🎓 *Role:*  Developer & Owner\n` +
            `┃ 🌍 *Base:*  Kenya 🇰🇪\n` +
            `┗━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
            `✨ _Tap the contact card below to save._\n` +
            `⚡ _Powered by ${BOT_NAME}_`;

        await reply(card);

        if (jid) {
            const vcard =
                'BEGIN:VCARD\n' +
                'VERSION:3.0\n' +
                `FN:${OWNER_NAME}\n` +
                `ORG:${BOT_NAME};\n` +
                `TEL;type=CELL;type=VOICE;waid=${number}:+${number}\n` +
                'END:VCARD';
            try {
                await sock.sendMessage(remoteJid, {
                    contacts: { displayName: OWNER_NAME, contacts: [{ vcard }] }
                }, { quoted: m });
            } catch (e) {
                console.error('❌ Owner vCard failed:', e.message);
            }
        }
        return true;
    }

    // ───────── 🧮 CALCULATOR ─────────
    if (command === 'calc' || command === 'calculate') {
        if (!args) { await reply('⚠️ Usage: *.calc 12*(3+4)/2*'); return true; }
        const expr = args.replace(/\^/g, '**').replace(/x/gi, '*');
        if (!/^[0-9+\-*/().%\s]+$/.test(expr)) {
            await reply('❌ Only numbers and + - * / ( ) % ^ are allowed.');
            return true;
        }
        try {
            const result = Function(`"use strict"; return (${expr})`)();
            if (typeof result !== 'number' || !isFinite(result)) throw new Error('bad');
            await reply(`🧮 *Calculator*\n\n📝 ${args}\n✅ *= ${result}*`);
        } catch {
            await reply('❌ Invalid expression.');
        }
        return true;
    }

    // ───────── 😂 JOKE ─────────
    if (command === 'joke') {
        try {
            const d = await getJson('https://v2.jokeapi.dev/joke/Any?safe-mode');
            const text = d.type === 'twopart' ? `${d.setup}\n\n👉 ${d.delivery}` : d.joke;
            await reply(`😂 *Joke*\n\n${text}`);
        } catch {
            await reply('❌ Could not fetch a joke right now.');
        }
        return true;
    }

    // ───────── 💬 QUOTE ─────────
    if (command === 'quote') {
        try {
            const d = await getJson('https://zenquotes.io/api/random');
            await reply(`💬 *Quote of the Moment*\n\n_"${d[0].q}"_\n\n— *${d[0].a}*`);
        } catch {
            await reply('❌ Could not fetch a quote right now.');
        }
        return true;
    }

    // ───────── 🧠 FACT ─────────
    if (command === 'fact') {
        try {
            const d = await getJson('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
            await reply(`🧠 *Random Fact*\n\n${d.text}`);
        } catch {
            await reply('❌ Could not fetch a fact right now.');
        }
        return true;
    }

    // ───────── 📖 DICTIONARY ─────────
    if (command === 'define' || command === 'dict') {
        if (!args) { await reply('⚠️ Usage: *.define resistor*'); return true; }
        try {
            const d = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(args)}`);
            const entry = d[0];
            const meaning = entry.meanings[0];
            const def = meaning.definitions[0];
            await reply(
                `📖 *${entry.word}* ${entry.phonetic ? `(${entry.phonetic})` : ''}\n` +
                `🏷️ _${meaning.partOfSpeech}_\n\n` +
                `📝 ${def.definition}` +
                (def.example ? `\n\n💡 _Example:_ ${def.example}` : '')
            );
        } catch {
            await reply(`❌ No definition found for *${args}*.`);
        }
        return true;
    }

    // ───────── 🌐 TRANSLATE ─────────
    if (command === 'tr' || command === 'translate') {
        const parts = args.split(' ');
        const lang = (parts.shift() || '').toLowerCase();
        const text = parts.join(' ').trim();
        if (!lang || !text) {
            await reply('⚠️ Usage: *.tr <lang code> <text>*\nExample: *.tr sw good morning*');
            return true;
        }
        try {
            const d = await getJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(lang)}`);
            const out = d.responseData?.translatedText;
            if (!out) throw new Error('empty');
            await reply(`🌐 *Translation (EN → ${lang.toUpperCase()})*\n\n${out}`);
        } catch {
            await reply('❌ Translation failed. Check the language code (e.g. sw, fr, es).');
        }
        return true;
    }

    // ───────── 🪙 FLIP / 🎲 DICE ─────────
    if (command === 'flip' || command === 'coin') {
        await reply(`🪙 *Coin Flip:* ${Math.random() < 0.5 ? 'Heads' : 'Tails'}`);
        return true;
    }
    if (command === 'dice' || command === 'roll') {
        const sides = Math.min(Math.max(parseInt(args) || 6, 2), 1000);
        await reply(`🎲 *Rolled a d${sides}:* ${Math.floor(Math.random() * sides) + 1}`);
        return true;
    }

    // ───────── 🔐 PASSWORD ─────────
    if (command === 'password' || command === 'pass') {
        const len = Math.min(Math.max(parseInt(args) || 14, 6), 64);
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
        const crypto = require('crypto');
        let pw = '';
        for (let i = 0; i < len; i++) pw += chars[crypto.randomInt(chars.length)];
        await reply(`🔐 *Generated Password (${len})*\n\n\`${pw}\`\n\n⚠️ _Don't reuse it anywhere._`);
        return true;
    }

    // ───────── 🔌 OHM'S LAW (engineering helper) ─────────
    if (command === 'ohm') {
        // usage: .ohm v=12 r=4   |  .ohm v=12 i=3  |  .ohm i=3 r=4
        const get = (k) => {
            const mt = args.match(new RegExp(`${k}\\s*=\\s*(-?[\\d.]+)`, 'i'));
            return mt ? parseFloat(mt[1]) : null;
        };
        const v = get('v'), i = get('i'), r = get('r');
        const given = [v, i, r].filter((x) => x !== null).length;
        if (given !== 2) {
            await reply('⚠️ Give exactly two values.\nExample: *.ohm v=12 r=4*');
            return true;
        }
        let V = v, I = i, R = r;
        if (V === null) V = I * R;
        else if (I === null) I = V / R;
        else R = V / I;
        const P = V * I;
        await reply(
            `🔌 *Ohm's Law*\n\n` +
            `⚡ Voltage: *${+V.toFixed(4)} V*\n` +
            `🔋 Current: *${+I.toFixed(4)} A*\n` +
            `🧱 Resistance: *${+R.toFixed(4)} Ω*\n` +
            `🔥 Power: *${+P.toFixed(4)} W*`
        );
        return true;
    }

    return false;
};