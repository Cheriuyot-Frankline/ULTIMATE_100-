module.exports = async function handleStatusSaver({
    command,
    args,
    reply,
    sock,
    m,
    isOwner,
    downloadMediaMessage,
    pino
}) {
    if (command === 'save' || command === 'savestatus' || command === 'savestory') {
        if (!isOwner) {
            await reply('🚫 This command is restricted to the bot owner.');
            return true;
        }

        const citedContext = m.message?.extendedTextMessage?.contextInfo;
        const quotedMessage = citedContext?.quotedMessage;

        if (!quotedMessage) {
            await reply('⚠️ Please *reply* to a status message or media with *save* to download it!');
            return true;
        }

        try {
            const fakeMsg = {
                key: {
                    remoteJid: 'status@broadcast',
                    id: citedContext.stanzaId,
                    participant: citedContext.participant
                },
                message: quotedMessage
            };

            const targetContent = quotedMessage.ephemeralMessage?.message || quotedMessage;
            let mediaType = null;
            if (targetContent.imageMessage) mediaType = 'image';
            else if (targetContent.videoMessage) mediaType = 'video';
            else if (targetContent.audioMessage) mediaType = 'audio';

            if (!mediaType) {
                await reply('❌ The replied status message does not contain downloadable media.');
                return true;
            }

            const mediaBuffer = await downloadMediaMessage(
                fakeMsg,
                'buffer',
                {},
                { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
            );

            const senderJid = citedContext.participant || 'Unknown';
            const captionText = targetContent.imageMessage?.caption || targetContent.videoMessage?.caption || '';
            const headerAlert = `📥 *SAVED STATUS*\n👤 *From:* @${senderJid.split('@')[0]}${captionText ? `\n💬 *Caption:* ${captionText}` : ''}`;
            const myDmAbbr = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : m.key.remoteJid;

            if (mediaType === 'image') {
                await sock.sendMessage(myDmAbbr, {
                    image: mediaBuffer,
                    caption: headerAlert,
                    mentions: [senderJid]
                });
            } else if (mediaType === 'video') {
                await sock.sendMessage(myDmAbbr, {
                    video: mediaBuffer,
                    caption: headerAlert,
                    mentions: [senderJid]
                });
            } else if (mediaType === 'audio') {
                await sock.sendMessage(myDmAbbr, { text: headerAlert });
                await sock.sendMessage(myDmAbbr, {
                    audio: mediaBuffer,
                    mimetype: targetContent.audioMessage.mimetype || 'audio/ogg; codecs=opus',
                    ptt: true
                });
            }

            console.log(`✅ Successfully saved and forwarded status from ${senderJid} to DM`);
        } catch (err) {
            console.error('❌ Status save error:', err.message);
            await reply('❌ Failed to download status media. Make sure you are replying directly to the status.');
        }

        return true;
    }

    return false;
};