
async function handleOwner({
    command,
    args,
    reply,
    isOwner,
    botMode,
    setBotMode,
    afk,
    TIMEZONE
}) {
    if (command === 'mode') {
        if (!isOwner) {
            await reply('🚫 Owner only.');
            return true;
        }

        const choice = args.toLowerCase();

        if (choice === 'private' || choice === 'public') {
            setBotMode(choice);
            await reply(
                `✅ Bot mode set to *${choice.toUpperCase()}*.`
            );
        } else {
            await reply(
                `⚠️ Use !mode private or !mode public.\nCurrent mode: *${botMode.toUpperCase()}*`
            );
        }

        return true;
    }

    if (command === 'afk') {
        if (!isOwner) {
            await reply('🚫 Owner only.');
            return true;
        }

        if (args.toLowerCase() === 'off') {
            afk.on = false;
            afk.notified.clear();
            await reply('✅ AFK mode OFF. Welcome back!');
        } else {
            afk.on = true;
            afk.reason = args || 'Busy';
            afk.since = new Date().toLocaleString(
                'en-GB',
                { timeZone: TIMEZONE }
            );
            afk.notified.clear();

            await reply(
                `😴 AFK mode ON.\nReason: ${afk.reason}\nUse !afk off to stop.`
            );
        }

        return true;
    }

    return false;
}

module.exports = handleOwner;
