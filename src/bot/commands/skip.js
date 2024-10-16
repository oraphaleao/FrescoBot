module.exports = {
    name: 'skip',
    execute(message, args, musicPlayer) {
        musicPlayer.skip(message);
    }
};