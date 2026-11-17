async function handleFlux({ command, args, reply, sock, m, remoteJid }) {
    if (command === 'flux' || command === 'imagine' || command === 'gen') {
        if (!args) {
            await reply('⚠️ Please provide a prompt for FLUX.\nExample: `!flux A futuristic cybernetic city at sunset`');
            return true;
        }

        const apiKey = process.env.NVIDIA_API_KEY || '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';
        const invokeUrl = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-3-image-klein";

        try {
            await reply(`🎨 Generating image with FLUX.3 for: "_${args}_"... Please wait.`);

            const response = await fetch(invokeUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt: args,
                    width: 1024,
                    height: 1024,
                    seed: 0,
                    steps: 30
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('NVIDIA FLUX API Error:', errText);
                await reply(`❌ FLUX generation failed (HTTP ${response.status}).`);
                return true;
            }

            const data = await response.json();
            
            // Extract the image base64 or URL depending on how the response is returned
            let imageBuffer = null;
            if (data.image) {
                imageBuffer = Buffer.from(data.image, 'base64');
            } else if (data.artifacts && data.artifacts[0]?.base64) {
                imageBuffer = Buffer.from(data.artifacts[0].base64, 'base64');
            } else if (data.data && data.data[0]?.url) {
                // If it returns a URL
                await sock.sendMessage(remoteJid, {
                    image: { url: data.data[0].url },
                    caption: `✨ *FLUX.3 Generation*\n💬 *Prompt:* ${args}`
                }, { quoted: m });
                return true;
            }

            if (imageBuffer) {
                await sock.sendMessage(remoteJid, {
                    image: imageBuffer,
                    caption: `✨ *FLUX.3 Generation*\n💬 *Prompt:* ${args}`
                }, { quoted: m });
            } else {
                await reply(`❌ Received an unexpected response format from FLUX API.`);
            }

        } catch (err) {
            console.error('FLUX Command Error:', err);
            await reply(`❌ An error occurred while generating the image.`);
        }

        return true;
    }

    return false;
}

module.exports = handleFlux;