async function handleAI({ command, args, reply, ai, aiReady, aiHistory, remoteJid, BOT_NAME }) {

    if (command === 'ai' || command === 'gpt') {

        if (!aiReady()) {
            await reply('⚠️ AI Module Offline. Configure your Gemini API key.');
            return true;
        }

        if (!args) {
            await reply('Example: !ai Explain thermodynamics');
            return true;
        }

        if (args.toLowerCase() === 'reset') {
            if (aiHistory && typeof aiHistory.delete === 'function') {
                aiHistory.delete(remoteJid);
            }
            await reply('🧹 AI memory cleared for this chat.');
            return true;
        }

        const history = (aiHistory && typeof aiHistory.get === 'function') 
            ? (aiHistory.get(remoteJid) || []) 
            : [];

        history.push({
            role: 'user',
            parts: [{ text: args }]
        });

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash', // <--- Updated model name here
                contents: history,
                config: {
                    systemInstruction:
                        `You are ${BOT_NAME}, a helpful WhatsApp assistant. Keep answers clear and concise.`
                }
            });

            const aiReply = response.text || 'I could not generate a response.';

            history.push({
                role: 'model',
                parts: [{ text: aiReply }]
            });

            while (history.length > 16) {
                history.splice(0, 2);
            }

            if (aiHistory && typeof aiHistory.set === 'function') {
                aiHistory.set(remoteJid, history);
            }

            await reply(`🧠 *Gemini AI Response:*\n\n${aiReply}`);

        } catch (err) {
            history.pop();
            console.error('Gemini API Error:', err.message);
            await reply('❌ Failed to fetch AI response.');
        }

        return true;
    }

    if (command === 'translate' || command === 'tr') {

        if (!aiReady()) {
            await reply('⚠️ AI Module Offline. Configure your Gemini API key.');
            return true;
        }

        const separator = args.indexOf('|');

        const language = separator === -1
            ? ''
            : args.slice(0, separator).trim();

        const text = separator === -1
            ? ''
            : args.slice(separator + 1).trim();

        if (!language || !text) {
            await reply('Example: !translate French | Good morning');
            return true;
        }

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash', // <--- Updated model name here too
                contents: `Translate the following text to ${language}. Reply with ONLY the translation:\n\n${text}`
            });

            await reply(`🌍 *${language}:*\n\n${response.text || 'Translation unavailable.'}`);

        } catch (err) {
            console.error('Translation error:', err.message);
            await reply('❌ Translation failed.');
        }

        return true;
    }

    return false;
}

module.exports = handleAI;