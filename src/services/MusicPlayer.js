const { getVoiceConnection, joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { EmbedBuilder, Colors } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const SpotifyHandler = require('./SpotifyHandler');
const YouTubeHandler = require('./YouTubeHandler');
const logger = require('../utils/logger');
const Utils = require('../utils/utils');

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
    
        const song = serverQueue[0]; // Não remover a música ainda
    
        try {
            let videoUrl;
            let songInfo;
    
            if (song.query.includes('open.spotify.com')) {
                // Obtendo informações da música do Spotify
                const trackInfo = await this.spotifyHandler.getTrackInfo(song.query);
                logger.info('Track info from Spotify:', trackInfo); // Log de debug
    
                videoUrl = await this.youtubeHandler.search(`${trackInfo.name} ${trackInfo.artists}`);
                logger.info('Video URL from YouTube search:', videoUrl); // Log de debug
                
                // Verifique se o videoUrl foi retornado corretamente
                if (!videoUrl) {
                    logger.error('No video URL found for track:', trackInfo);
                    throw new Error('Video URL not found');
                }
    
                songInfo = {
                    title: trackInfo.name || 'Unknown Title',
                    author: trackInfo.artists || 'Unknown',
                    duration: trackInfo.duration ? Utils.formatDuration(trackInfo.duration) : 'Unkown',
                    thumbnail: trackInfo.albumCover || null // Pega a miniatura (capa do álbum)
                };
            } else {
                videoUrl = await this.youtubeHandler.search(song.query);
                logger.info('Video URL from search:', videoUrl); // Log de debug
                if (videoUrl) {
                    songInfo = await ytdl.getInfo(videoUrl); // Buscar informações sobre a música do YouTube
                    logger.info('Song info from YouTube:', songInfo); // Log de debug

                    // Definindo songInfo com informações do YouTube
                    const videoDetails = songInfo.videoDetails;

                    // Condições para extrair informações relevantes do YouTube
                    songInfo = {
                        title: videoDetails.title || 'Unknown Title',
                        author: videoDetails.author.name || 'Unknown',
                        duration: videoDetails.lengthSeconds ? Utils.formatDuration(videoDetails.lengthSeconds) : 'Unknown',
                        thumbnail: videoDetails.thumbnails?.[0]?.url || null // Miniatura do vídeo
                    };
                }
            }
    
            if (!videoUrl || !songInfo) {
                if (message) message.channel.send('Could not find the song on YouTube. Skipping to next song.');
                serverQueue.shift(); // Remover a música se não puder ser reproduzida
                return this.playNext(connection, message);
            }
    
            const stream = ytdl(videoUrl, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
            });
    
            const resource = createAudioResource(stream);
            this.player.play(resource);
    
            // Se a informação da música for do YouTube, extraia a miniatura
            const thumbnail = songInfo.thumbnail || songInfo.videoDetails?.thumbnails?.[0]?.url || null;
    
            // Criar o embed com informações da música e miniatura
            const embed = new EmbedBuilder()
                .setTitle(`🎶 Now Playing`)
                .setDescription(`[${songInfo.title}](${videoUrl})`)
                .addFields(
                    { name: 'Requested by', value: `<@${song.requester}>`, inline: true },
                    { name: 'Author', value: songInfo.author, inline: true },
                    { name: 'Duration', value: songInfo.duration, inline: true },
                    { name: 'Queue Position', value: `#${serverQueue.length}`, inline: true }
                )
                .setColor(Colors.Blue) // Use o enum Colors
                .setThumbnail(thumbnail) // Adiciona a miniatura
                .setTimestamp();
    
            if (message) {
                message.channel.send({ embeds: [embed] });
            }
    
            serverQueue.shift(); // Remover a música da fila após começar a tocar
    
            stream.on('error', (error) => {
                logger.error('Error in audio stream:', error);
                if (message) message.channel.send('There was an error playing this song. Skipping to next song.');
                this.playNext(connection, message);
            });
    
        } catch (error) {
            console.log(error);
            logger.error('Error in playNext method:', error);
            if (message) message.channel.send('There was an error playing this song. Skipping to next song.');
            serverQueue.shift(); // Remover a música problemática
            this.playNext(connection, message);
        }
    }

    stop(message) {
        const guildId = message.guild.id;
        const serverQueue = this.queue.get(guildId);
    
        if (serverQueue) {
            serverQueue.songs = []; // Limpa a fila
            this.queue.delete(guildId); // Remove a fila atual
        }
    
        // Destruir a conexão de voz
        const connection = getVoiceConnection(guildId);
        if (connection) {
            connection.destroy();
        }
    
        message.channel.send('Playback stopped and queue cleared.');
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