const { getVoiceConnection, joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const SpotifyHandler = require('./SpotifyHandler');
const YouTubeHandler = require('./YouTubeHandler');
const logger = require('../utils/logger');

class MusicPlayer {
    constructor() {
        this.queue = new Map();
        this.player = createAudioPlayer();
        this.spotifyHandler = new SpotifyHandler();
        this.youtubeHandler = new YouTubeHandler();

        this.player.on('error', (error) => {
            logger.error('Error in audio player:', error);
            this.playNext(this.currentConnection, this.currentMessage);
        });

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.playNext(this.currentConnection, this.currentMessage);
        });

        this.currentConnection = null;
        this.currentMessage = null;
    }

    async play(message, query) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('You need to be in a voice channel to play music!');
        }

        try {
            if (!this.queue.has(message.guild.id)) {
                this.queue.set(message.guild.id, []);
                this.currentConnection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });
                this.currentConnection.subscribe(this.player);
            }

            const serverQueue = this.queue.get(message.guild.id);
            serverQueue.push({ query, requester: message.author.id });

            if (serverQueue.length === 1 && this.player.state.status !== AudioPlayerStatus.Playing) {
                this.currentMessage = message;
                await this.playNext(this.currentConnection, message);
            } else {
                message.reply(`Added to queue: ${query}`);
            }
        } catch (error) {
            logger.error('Error in play method:', error);
            message.reply('There was an error trying to play the music. Please try again.');
        }
    }

    async playNext(connection, message) {
        const guildId = message?.guild.id || connection?.joinConfig.guildId;
        if (!guildId) {
            logger.error('Unable to determine guild ID in playNext');
            return;
        }

        const serverQueue = this.queue.get(guildId);
        if (!serverQueue || serverQueue.length === 0) {
            this.queue.delete(guildId);
            if (connection) connection.destroy();
            this.currentConnection = null;
            this.currentMessage = null;
            return;
        }

        const song = serverQueue[0]; // Don't remove the song yet

        try {
            let videoUrl;
            if (song.query.includes('open.spotify.com')) {
                const trackInfo = await this.spotifyHandler.getTrackInfo(song.query);
                videoUrl = await this.youtubeHandler.search(`${trackInfo.name} ${trackInfo.artists}`);
            } else {
                videoUrl = await this.youtubeHandler.search(song.query);
            }

            if (!videoUrl) {
                if (message) message.channel.send('Could not find the song on YouTube. Skipping to next song.');
                serverQueue.shift(); // Remove the song if it can't be played
                return this.playNext(connection, message);
            }

            const stream = ytdl(videoUrl, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
            });

            const resource = createAudioResource(stream);

            this.player.play(resource);

            if (message) message.channel.send(`Now playing: ${videoUrl}`);

            serverQueue.shift(); // Remove the song only after it starts playing

            stream.on('error', (error) => {
                logger.error('Error in audio stream:', error);
                if (message) message.channel.send('There was an error playing this song. Skipping to next song.');
                this.playNext(connection, message);
            });

        } catch (error) {
            logger.error('Error in playNext method:', error);
            if (message) message.channel.send('There was an error playing this song. Skipping to next song.');
            serverQueue.shift(); // Remove the problematic song
            this.playNext(connection, message);
        }
    }

    stop(message) {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            this.queue.delete(message.guild.id);
            this.player.stop();
            this.currentConnection = null;
            this.currentMessage = null;
            message.reply('Music stopped and disconnected from voice channel.');
        } else {
            message.reply('I\'m not in a voice channel!');
        }
    }

    skip(message) {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) {
            return message.reply('I\'m not playing any music right now.');
        }

        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue || serverQueue.length === 0) {
            return message.reply('There are no songs in the queue to play.');
        }

        this.player.stop(); // This will trigger the 'idle' event, which will call playNext
        message.reply('Song skipped!');
    }
}

module.exports = MusicPlayer;