console.log("🚀 Starting ULTIMATE_100 Bot...");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    downloadMediaMessage,
    normalizeMessageContent
} = require('@whiskeysockets/baileys');
const { GoogleGenAI } = require('@google/genai');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

// ==========================================
// 🤖 CONFIGURATION & IMPORTS
// ==========================================
const { BOT_NAME, CREATOR, OWNER_NAME, ALLOWED_PREFIXES, GEMINI_API_KEY, DEEPSEEK_API_KEY, TIMEZONE } = require('./config');

// Handle @distube/ytdl-core v4 vs v5 compatibility safely
const ytdlModule = require('@distube/ytdl-core');
let ytdlInstance = ytdlModule;
let ytdlGetInfo = ytdlModule.getInfo;
let ytdlDownload = ytdlModule;

if (ytdlModule.Ytdl) {
    ytdlInstance = new ytdlModule.Ytdl();
    ytdlGetInfo = (url) => ytdlInstance.getInfo(url);
    ytdlDownload = (info, opts) => ytdlInstance.download(info, opts);
}

const handleFun = require('./commands/fun');
const handleGroup = require('./commands/group');
const handleOwner = require('./commands/owner');
const handleAI = require('./commands/ai');
const handleStatusSaver = require('./commands/statusSaver');

const HAS_AI_KEY = !!GEMINI_API_KEY && !/^YOUR_/i.test(GEMINI_API_KEY);
const ai = HAS_AI_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const HAS_DS_KEY = !!DEEPSEEK_API_KEY && !/^YOUR_/i.test(DEEPSEEK_API_KEY);
const dsHistory = new Map();

const messageStore = new Map();
const viewOnceStore = new Map();
const MAX_STORE_SIZE = 100;
const MAX_VIEW_ONCE = 30;
const viewedStatuses = new Set();
let ownerJid = null;

const cooldowns = new Map();
const COOLDOWN_MS = 3000;
const MAX_AI_TURNS = 8;

// Helper to deeply unwrap all WA nested containers
function unwrapMessage(message) {
    if (!message) return message;
    let content = normalizeMessageContent(message) || message;
    while (content?.associatedChildMessage) {
        content = normalizeMessageContent(content.associatedChildMessage) || content.associatedChildMessage;
    }
    return content;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        syncFullHistory: false,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'close') startBot();
        if (connection === 'open' && sock.user) {
            ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            console.log(`✅ [${BOT_NAME}] Online! Owner: ${ownerJid}`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const m = chatUpdate.messages[0];
        if (!m || !m.message) return;

        // 1. SILENT AUTO-VIEW STATUS
        if (m.key.remoteJid === 'status@broadcast') {
            const statusJid = m.key.participant || m.participant || '';
            const statusId = m.key.id;
            if (viewedStatuses.has(statusId)) return;
            viewedStatuses.add(statusId);

            try {
                await sock.readMessages([{ remoteJid: 'status@broadcast', id: statusId, participant: statusJid }]);
                await sock.sendPresenceUpdate('available', statusJid);
            } catch (err) {
                console.error('❌ Status view error:', err.message);
            }
            return;
        }

        const remoteJid = m.key.remoteJid;
        const isGroup = remoteJid.endsWith('@g.us');
        const senderJid = isGroup ? (m.key.participant || m.participant) : remoteJid;

        // 2. REACTION-BASED VIEW-ONCE & MEDIA RECOVERY
        const reaction = m.message.reactionMessage;
        if (reaction && m.key.fromMe && reaction.text?.startsWith('👍') && ownerJid) {
            const targetMsgId = reaction.key.id;
            const cached = viewOnceStore.get(targetMsgId) || messageStore.get(targetMsgId);
            
            if (cached?.mediaBuffer) {
                try {
                    const alertHeader = `🚨 *RECOVERED VIEW ONCE*\n👤 *From:* @${cached.sender.split('@')[0]}\n⏰ *Time:* ${cached.time}`;
                    
                    if (cached.mediaType === 'video') {
                        await sock.sendMessage(ownerJid, { video: cached.mediaBuffer, caption: alertHeader, mentions: [cached.sender] });
                    } else if (cached.mediaType === 'image') {
                        await sock.sendMessage(ownerJid, { image: cached.mediaBuffer, caption: alertHeader, mentions: [cached.sender] });
                    } else if (cached.mediaType === 'audio' || cached.mediaType === 'voice_note') {
                        await sock.sendMessage(ownerJid, { text: alertHeader, mentions: [cached.sender] });
                        await sock.sendMessage(ownerJid, { 
                            audio: cached.mediaBuffer, 
                            mimetype: cached.mimetype || 'audio/ogg; codecs=opus', 
                            ptt: true 
                        });
                    }
                    await sock.sendMessage(remoteJid, { react: { text: '✅', key: reaction.key } });
                    console.log(`✅ Successfully recovered and forwarded view-once media via 👍`);
                } catch (err) {
                    console.error('❌ View-once recovery send error:', err.message);
                }
            } else {
                console.warn(`⚠️ View-once [${targetMsgId}] missing from cache or buffer is empty.`);
            }
            return;
        }

        // 3. UNWRAP & EXTRACT
        const msgRoot = m.message;
        const actualContent = unwrapMessage(msgRoot);

        const isViewOnce = !!(
            msgRoot.viewOnceMessage || msgRoot.viewOnceMessageV2 || msgRoot.viewOnceMessageV2Extension ||
            actualContent.imageMessage?.viewOnce || actualContent.videoMessage?.viewOnce || actualContent.audioMessage?.viewOnce
        );

        let mediaType = null;
        if (actualContent.imageMessage) mediaType = 'image';
        else if (actualContent.videoMessage) mediaType = 'video';
        else if (actualContent.audioMessage) mediaType = 'audio';
        else if (actualContent.documentMessage) mediaType = 'document';

        const messageText = actualContent.conversation || actualContent.extendedTextMessage?.text || actualContent.imageMessage?.caption || '';

        // 4. CACHE MEDIA
        if (messageText || mediaType) {
            let mediaBuffer = null;
            let mimetype = null;

            if (mediaType) {
                try {
                    mediaBuffer = await downloadMediaMessage(
                        { key: m.key, message: actualContent },
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                    );
                    mimetype = actualContent[`${mediaType}Message`]?.mimetype;
                } catch (dlErr) {}
            }

            const entry = { sender: senderJid, chat: remoteJid, text: messageText, mediaType, mediaBuffer, mimetype, time: new Date().toLocaleString() };
            messageStore.set(m.key.id, entry);
            if (messageStore.size > MAX_STORE_SIZE) messageStore.delete(messageStore.keys().next().value);

            if (isViewOnce && mediaBuffer) {
                viewOnceStore.set(m.key.id, entry);
                if (viewOnceStore.size > MAX_VIEW_ONCE) viewOnceStore.delete(viewOnceStore.keys().next().value);
            }
        }

        if (!messageText) return;

        // 5. COMMAND PARSING
        const rawText = messageText.trim();
        const usedPrefix = ALLOWED_PREFIXES.find((p) => rawText.startsWith(p));
        if (!usedPrefix) return;

        const withoutPrefix = rawText.slice(usedPrefix.length).trim();
        const spaceIndex = withoutPrefix.indexOf(' ');
        const command = spaceIndex === -1 ? withoutPrefix.toLowerCase() : withoutPrefix.slice(0, spaceIndex).toLowerCase();
        const args = spaceIndex === -1 ? '' : withoutPrefix.slice(spaceIndex + 1).trim();

        const reply = async (text) => {
            try { await sock.sendMessage(remoteJid, { text }, { quoted: m }); } catch (e) {}
        };

        const isOwner = !!m.key.fromMe;
        if (!isOwner) {
            if (Date.now() - (cooldowns.get(senderJid) || 0) < COOLDOWN_MS) return;
            cooldowns.set(senderJid, Date.now());
        }

        // ⚡ INSTANT COMMAND ACKNOWLEDGEMENT REACTION
        try {
            await sock.sendMessage(remoteJid, { react: { text: '⚡', key: m.key } });
        } catch (e) {}

        const ctx = {
            command, args, reply, sock, m, remoteJid, senderJid, isOwner,
            BOT_NAME, OWNER_NAME, ai, aiReady: () => HAS_AI_KEY,
            downloadMediaMessage, unwrapMessage, pino
        };

        // Sub-modules check
        if (await handleStatusSaver(ctx)) return;
        if (await handleFun(ctx)) return;
        if (await handleGroup(ctx)) return;
        if (await handleOwner(ctx)) return;
        if (await handleAI(ctx)) return;

        // ==========================================
        // 🌍 CLEAN ASCII DOUBLE-LINE MENU WITH SIGNATURE
        // ==========================================
        if (command === 'menu' || command === 'help') {
            await reply(
                `╔════════════════════════════════╗\n` +
                `║       🤖 *${BOT_NAME.toUpperCase()}*       ║\n` +
                `║       👑 *Owner:* ${OWNER_NAME}       ║\n` +
                `╚════════════════════════════════╝\n\n` +
                `╔═════ 🛡️ **ACTIVE SHIELDS** ═════╗\n` +
                `╠ • Anti-Delete\n` +
                `╠ • Auto-View Status\n` +
                `╠ • View Once Recovery\n` +
                `╚════════════════════════════════╝\n\n` +
                `╔═════ 📊 **UTILITIES & MEDIA** ═════╗\n` +
                `╠ • play / song\n` +
                `╠ • flux / image\n` +
                `╠ • save\n` +
                `╠ • status\n` +
                `╠ • time\n` +
                `╠ • ping\n` +
                `╚════════════════════════════════╝\n\n` +
                `╔═════ 🧠 **AI & TOOLS** ═════════╗\n` +
                `╠ • ai\n` +
                `╠ • ds\n` +
                `╠ • ds reset\n` +
                `╠ • weather\n` +
                `╚════════════════════════════════╝\n\n` +
                `⚡ *ULTIMATE_100 generation*`
            );
        }
        
        else if (command === 'ping') {
            const latency = Math.max(0, Date.now() - Number(m.messageTimestamp) * 1000);
            await reply(`🏓 *Pong* ~${latency} ms`);
        }

        else if (command === 'status') {
            const uptime = Math.floor(process.uptime());
            const hrs = Math.floor(uptime / 3600);
            const mins = Math.floor((uptime % 3600) / 60);
            const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
            await reply(
                `╔════════════════════════════════╗\n` +
                `║      ⚡ *${BOT_NAME.toUpperCase()} STATUS*      ║\n` +
                `╚════════════════════════════════╝\n` +
                `╔════════════════════════════════╗\n` +
                `╠ 🟢 *State:* Online & Ready\n` +
                `╠ ⏱️ *Uptime:* ${hrs}h ${mins}m\n` +
                `╠ 🧠 *RAM Usage:* ${ram} MB\n` +
                `╠ 📦 *Message Cache:* ${messageStore.size} entries\n` +
                `╚════════════════════════════════╝\n\n` +
                `⚡ *ULTIMATE_100 generation*`
            );
        }

        else if (command === 'time') {
            const now = new Date();
            await reply(
                `┌──────────────────────┐\n` +
                `   🕒 *DATE & TIME* \n` +
                `└──────────────────────┘\n` +
                `📅 *Date:* ${now.toLocaleDateString('en-GB', { timeZone: TIMEZONE, dateStyle: 'full' })}\n` +
                `⏰ *Time:* ${now.toLocaleTimeString('en-GB', { timeZone: TIMEZONE })} (EAT)\n\n` +
                `⚡ *ULTIMATE_100 generation*`
            );
        }

        // --- Flux Image Generation (flux / image) ---
        else if (command === 'flux' || command === 'image' || command === 'img') {
            if (!args) return reply(`⚠️ Provide a prompt for the image. Example: *flux futuristic cyberpunk city in neon lights*`);
            try {
                await reply(`🎨 Generating image with Flux... Please wait.`);
                const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(args)}?width=1024&height=1024&nologo=true`;
                
                await sock.sendMessage(remoteJid, {
                    image: { url: imageUrl },
                    caption: `🎨 *Prompt:* ${args}\n\n⚡ *ULTIMATE_100 generation*`
                }, { quoted: m });
            } catch (err) {
                console.error('❌ Flux image error:', err);
                await reply(`❌ Failed to generate image.`);
            }
        }

        // --- YouTube Audio (play / song) ---
        else if (command === 'play' || command === 'song' || command === 'yt' || command === 'audio') {
            if (!args) return reply(`⚠️ Provide a song name or YouTube URL. Example: *play shape of you*`);
            try {
                let videoUrl = args;
                if (!/^https?:\/\//i.test(args)) {
                    await reply(`🔍 Searching YouTube for *${args}*...`);
                    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(args)}`);
                    const html = await res.text();
                    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
                    if (!match) return reply(`❌ No results found.`);
                    videoUrl = `https://www.youtube.com/watch?v=${match[1]}`;
                }

                await reply(`🎵 Downloading audio stream... Please wait.`);
                const info = await ytdlGetInfo(videoUrl);
                const cleanTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '').trim();

                const audioFormat = info.formats.find((f) => f.hasAudio && !f.hasVideo);
                const realMime = audioFormat?.mimeType?.split(';')[0] || 'audio/mp4';

                const stream = ytdlDownload(info, { quality: 'highestaudio', filter: 'audioonly' });
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                const buffer = Buffer.concat(chunks);

                if (!buffer.length) return reply(`❌ Empty audio stream received.`);
                
                await sock.sendMessage(remoteJid, {
                    audio: buffer,
                    mimetype: realMime,
                    fileName: `${cleanTitle}.${realMime.includes('ogg') ? 'ogg' : 'm4a'}`,
                    caption: `🎵 *Title:* ${info.videoDetails.title}\n\n⚡ *ULTIMATE_100 generation*`
                }, { quoted: m });
            } catch (err) {
                console.error('❌ Play error:', err);
                await reply(`❌ Failed to download audio. The video may be restricted.`);
            }
        }

        // --- DeepSeek AI Integration (ds) ---
        else if (command === 'ds' || command === 'deepseek') {
            if (!HAS_DS_KEY) {
                await reply(`⚠️ DeepSeek AI is offline. Missing *DEEPSEEK_API_KEY* in .env.`);
                return;
            }
            if (!args) {
                await reply(`⚠️ Ask something! Example: *.ds What is Ohm's law?*\nUse *.ds reset* to clear memory.`);
                return;
            }
            if (args.toLowerCase() === 'reset' || args.toLowerCase() === 'clear') {
                dsHistory.delete(remoteJid);
                await reply(`🧹 DeepSeek conversation memory cleared for this chat.`);
                return;
            }
            try {
                const history = dsHistory.get(remoteJid) || [];
                history.push({ role: 'user', content: args });

                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 30000);

                const res = await fetch('https://api.deepseek.com/chat/completions', {
                    method: 'POST',
                    signal: ctrl.signal,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [
                            { role: 'system', content: `You are ${BOT_NAME}, a helpful WhatsApp assistant. Keep answers clear and well-formatted for WhatsApp.` },
                            ...history
                        ]
                    })
                });
                clearTimeout(timer);

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const answer = data.choices?.[0]?.message?.content?.trim();

                if (!answer) {
                    await reply(`⚠️ DeepSeek returned an empty response.`);
                    return;
                }

                history.push({ role: 'assistant', content: answer });
                while (history.length > MAX_AI_TURNS * 2) {
                    history.shift();
                }
                dsHistory.set(remoteJid, history);

                await reply(`🧠 *DeepSeek:*\n\n${answer}\n\n⚡ *ULTIMATE_100 generation*`);
            } catch (err) {
                await reply(`❌ DeepSeek request failed. Check your connection or API key.`);
            }
        }

        // --- Weather Command (weather) ---
        else if (command === 'weather' || command === 'wx') {
            if (!args) return reply(`⚠️ Usage: *weather <city>*\nExample: *weather Nairobi*`);
            try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args)}&count=1&language=en&format=json`);
                const geoData = await geoRes.json();
                if (!geoData.results?.length) return reply(`❌ City *${args}* not found.`);
                
                const loc = geoData.results[0];
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`);
                const wData = await weatherRes.json();
                const w = wData.current_weather;

                await reply(
                    `🌤️ *Weather — ${loc.name}, ${loc.country}*\n\n` +
                    `🌡️ Temperature: ${w.temperature}°C\n` +
                    `💨 Wind Speed: ${w.windspeed} km/h\n` +
                    `⏰ Observation Time: ${w.time}\n\n` +
                    `⚡ *ULTIMATE_100 generation*`
                );
            } catch (err) {
                await reply(`❌ Weather service unavailable right now.`);
            }
        }
    });

    // 6. ROBUST ANTI-DELETE RECOVERY
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            const content = update.update?.message;
            const proto = update.update?.protocolMessage;
            
            if (content === null || proto?.type === 0 || proto?.type === 'REVOKE') {
                const msgId = update.key?.id;
                if (!msgId || !messageStore.has(msgId)) continue;
                
                const targetOwner = ownerJid || (sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null);
                if (!targetOwner) continue;

                const cached = messageStore.get(msgId);
                try {
                    if (cached.mediaBuffer) {
                        const captionTag = `🚨 *ANTI-DELETE: Recovered ${cached.mediaType}*\n\n⚡ *ULTIMATE_100 generation*`;
                        if (cached.mediaType === 'image') {
                            await sock.sendMessage(targetOwner, { image: cached.mediaBuffer, caption: captionTag });
                        } else if (cached.mediaType === 'video') {
                            await sock.sendMessage(targetOwner, { video: cached.mediaBuffer, caption: captionTag });
                        } else if (cached.mediaType === 'audio') {
                            await sock.sendMessage(targetOwner, { text: captionTag });
                            await sock.sendMessage(targetOwner, { audio: cached.mediaBuffer, mimetype: cached.mimetype, ptt: true });
                        }
                    } else if (cached.text) {
                        await sock.sendMessage(targetOwner, { text: `🚨 *ANTI-DELETE: Recovered text*\n\n"${cached.text}"\n\n⚡ *ULTIMATE_100 generation*` });
                    }
                } catch (e) {
                    console.error('❌ Anti-delete forward failed:', e.message);
                }
                messageStore.delete(msgId);
            }
        }
    });
}

startBot();