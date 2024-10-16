module.exports = {
    name: 'stop',
    execute(message, args, musicPlayer) {
        musicPlayer.stop(message);
    }
};