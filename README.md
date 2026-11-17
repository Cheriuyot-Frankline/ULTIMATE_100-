# 🤖 ULTIMATE_100 WhatsApp Bot

A feature-rich Baileys WhatsApp bot featuring anti-delete protection, view-once recovery, AI integration (Gemini & DeepSeek), media downloaders, and more.

## 🛡️ Features
- **Anti-Delete:** Automatically recovers deleted text, media, and voice notes.
- **Auto-View Status:** Silently views WhatsApp statuses.
- **AI Integration:** Built-in support for Gemini and DeepSeek.
- **Media Tools:** YouTube audio streaming, Pixabay images, and FLUX.3 image generation.

## ⚙️ Configuration (.env)
Create a `.env` file in the root directory with the following variables:
```env
BOT_NAME=ULTIMATE_100
OWNER_NAME=YourName
ALLOWED_PREFIXES=.,!,/
GEMINI_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_here
WHATSAPP_SESSION=your_base64_session_string
