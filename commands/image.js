const axios = require('axios');

async function handleImage({ command, args, reply, remoteJid }) {
    if (command === 'image' || command === 'photo' || command === 'pixabay') {
        if (!args) {
            await reply('⚠️ Please specify what you want to search for.\nExample: `!image futuristic city`');
            return true;
        }

        const apiKey = process.env.PIXABAY_API_KEY;
        if (!apiKey) {
            await reply('⚠️ Pixabay API key is not configured.');
            return true;
        }

        try {
            await reply(`🔍 Searching Pixabay for "${args}"...`);

            const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(args)}&image_type=photo&safesearch=true&per_page=3`;
            const response = await axios.get(url);
            const data = response.data;

            if (!data.hits || data.hits.length === 0) {
                await reply(`❌ No images found for "${args}". Try a different search term.`);
                return true;
            }

            // Pick the first result's large image URL
            const imageUrl = data.hits[0].largeImageURL;
            const photographer = data.hits[0].user;

            // Note: Depending on how your bot handles media sending (e.g., using Baileys or WhatsApp Web.js), 
            // you can pass the imageUrl directly to your media sender.
            await reply(`📸 *Pixabay Result* (Photo by ${photographer}):\n${imageUrl}`);

        } catch (err) {
            console.error('Pixabay API Error:', err.message);
            await reply('❌ Failed to fetch image from Pixabay.');
        }

        return true;
    }

    return false;
}

module.exports = handleImage;