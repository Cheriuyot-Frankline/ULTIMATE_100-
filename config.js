require('dotenv').config();

module.exports = {
    BOT_NAME: process.env.BOT_NAME || 'ULTIMATE_100',
    CREATOR: process.env.CREATOR || 'Eng. Frank',
    OWNER_NAME: process.env.OWNER_NAME || 'Kirwa Franklin',
    ALLOWED_PREFIXES: (process.env.ALLOWED_PREFIXES || '!,.,/').split(','),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    PIXABAY_API_KEY: process.env.PIXABAY_API_KEY || '',
    TIMEZONE: process.env.TIMEZONE || 'Africa/Nairobi',
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || '',
    WHATSAPP_SESSION: process.env.WHATSAPP_SESSION || ''
};