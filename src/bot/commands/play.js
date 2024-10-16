module.exports = {
    name: 'play',
    async execute(message, args, musicPlayer) {
        const query = args.join(' ');
        if (!query) return message.reply('Please provide a song to play!');
        await musicPlayer.play(message, query);
    }
};