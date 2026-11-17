
async function handleGroup({
    command,
    args,
    reply,
    sock,
    remoteJid,
    senderJid,
    isGroup,
    isOwner,
    getGroupInfo,
    welcomeChats
}) {

    if (command === 'groupinfo' || command === 'ginfo') {
        if (!isGroup) {
            await reply('⚠️ This command works in groups only.');
            return true;
        }

        try {
            const meta = await sock.groupMetadata(remoteJid);
            const admins = meta.participants.filter(p => p.admin).length;

            await reply(
                `👥 *GROUP INFO*\n\n` +
                `📛 Name: ${meta.subject}\n` +
                `👤 Members: ${meta.participants.length}\n` +
                `🛡️ Admins: ${admins}\n` +
                `📝 Description: ${meta.desc || 'None'}`
            );
        } catch (err) {
            console.error('Groupinfo error:', err.message);
            await reply('❌ Could not fetch group information.');
        }

        return true;
    }

    if (command === 'tagall') {
        if (!isGroup) {
            await reply('⚠️ This command works in groups only.');
            return true;
        }

        try {
            const { meta, isAdmin } = await getGroupInfo(
                sock,
                remoteJid,
                senderJid
            );

            if (!isAdmin && !isOwner) {
                await reply('🚫 Only group admins can use this command.');
                return true;
            }

            const ids = meta.participants.map(p => p.id);

            const text =
                `📢 *${args || 'Attention everyone!'}*\n\n` +
                ids.map(id => `@${id.split('@')[0]}`).join(' ');

            await sock.sendMessage(
                remoteJid,
                { text, mentions: ids }
            );

        } catch (err) {
            console.error('Tagall error:', err.message);
            await reply('❌ Could not tag group members.');
        }

        return true;
    }

    if (command === 'welcome') {
        if (!isGroup) {
            await reply('⚠️ This command works in groups only.');
            return true;
        }

        try {
            const { isAdmin } = await getGroupInfo(
                sock,
                remoteJid,
                senderJid
            );

            if (!isAdmin && !isOwner) {
                await reply('🚫 Only group admins can change this setting.');
                return true;
            }

            const choice = args.toLowerCase();

            if (choice === 'on') {
                welcomeChats.add(remoteJid);
                await reply('✅ Welcome messages enabled.');
            } else if (choice === 'off') {
                welcomeChats.delete(remoteJid);
                await reply('✅ Welcome messages disabled.');
            } else {
                await reply(
                    `Current setting: ${welcomeChats.has(remoteJid) ? 'ON' : 'OFF'}\n` +
                    'Use !welcome on or !welcome off.'
                );
            }

        } catch (err) {
            console.error('Welcome error:', err.message);
            await reply('❌ Could not update welcome settings.');
        }

        return true;
    }

    return false;
}

module.exports = handleGroup;
