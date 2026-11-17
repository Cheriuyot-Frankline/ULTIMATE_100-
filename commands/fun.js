
const crypto = require('crypto');

async function handleFun({ command, args, reply, isGroup }) {

    // CALCULATOR
    if (command === 'calc' || command === 'math') {
        if (!args) {
            await reply('Example: !calc 25*4');
            return true;
        }

        try {
            const cleaned = args.replace(/\^/g, '**');

            if (!/^[0-9+\-*/().%\s*]+$/.test(cleaned) ||
                cleaned.length > 100) {
                throw new Error('Invalid mathematical expression');
            }

            const result = Function(`"use strict"; return (${cleaned})`)();

            if (!Number.isFinite(result)) {
                throw new Error('Invalid result');
            }

            await reply(`🧮 ${args} = ${result}`);
        } catch (err) {
            await reply(`❌ ${err.message}`);
        }
        return true;
    }

    // COIN FLIP
    if (command === 'flip' || command === 'coin') {
        await reply(`🪙 ${crypto.randomInt(2) ? 'Heads' : 'Tails'}!`);
        return true;
    }

    // DICE
    if (command === 'dice' || command === 'roll') {
        const sides = Math.min(1000, Math.max(2, parseInt(args) || 6));
        await reply(`🎲 You rolled ${crypto.randomInt(1, sides + 1)} (d${sides})`);
        return true;
    }

    // 8 BALL
    if (command === '8ball') {
        if (!args) {
            await reply('Ask a question! Example: !8ball Will I pass?');
            return true;
        }

        const answers = [
            'Yes, definitely.',
            'It is certain.',
            'Most likely.',
            'Signs point to yes.',
            'Ask again later.',
            'Cannot predict now.',
            'Do not count on it.',
            'Very doubtful.'
        ];

        await reply(`🎱 ${answers[crypto.randomInt(answers.length)]}`);
        return true;
    }

    // RANDOM PICKER
    if (command === 'pick' || command === 'choose') {
        const options = args.split(',')
            .map(x => x.trim())
            .filter(Boolean);

        if (options.length < 2) {
            await reply('Example: !pick pizza, burger, rice');
            return true;
        }

        await reply(`🎯 I pick: *${options[crypto.randomInt(options.length)]}*`);
        return true;
    }

    // PASSWORD GENERATOR
    if (command === 'password' || command === 'pass') {
        if (isGroup) {
            await reply('🔐 Use this command in a private chat.');
            return true;
        }

        const length = Math.min(64, Math.max(8, parseInt(args) || 16));
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';

        let password = '';

        for (let i = 0; i < length; i++) {
            password += chars[crypto.randomInt(chars.length)];
        }

        await reply(`🔐 Generated password:\n\n${password}`);
        return true;
    }

    // JOKE
    if (command === 'joke') {
        try {
            const res = await fetch(
                'https://v2.jokeapi.dev/joke/Programming,Misc,Pun?blacklistFlags=nsfw,religious,political,racist,sexist,explicit'
            );

            const data = await res.json();

            if (data.error) throw new Error('Joke unavailable');

            const joke = data.type === 'single'
                ? data.joke
                : `${data.setup}\n\n👉 ${data.delivery}`;

            await reply(`😂 *Joke*\n\n${joke}`);
        } catch {
            await reply('❌ Could not fetch a joke right now.');
        }

        return true;
    }

    // QUOTE
    if (command === 'quote') {
        try {
            const res = await fetch('https://zenquotes.io/api/random');
            const data = await res.json();

            await reply(`💭 _"${data[0].q}"_\n\n— *${data[0].a}*`);
        } catch {
            await reply('❌ Could not fetch a quote right now.');
        }

        return true;
    }

    // UNKNOWN COMMAND
    return false;
}

module.exports = handleFun;
