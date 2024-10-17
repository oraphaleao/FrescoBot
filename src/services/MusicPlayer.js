const {
    getVoiceConnection,
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
} = require('@discordjs/voice');
const { EmbedBuilder, Colors } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const SpotifyHandler = require('./SpotifyHandler');
const YouTubeHandler = require('./YouTubeHandler');
const logger = require('../utils/logger');
const Utils = require('../utils/utils');
const config = require('../../config/config');

class MusicPlayer {
    constructor() {
        this.queue = new Map();
        this.player = createAudioPlayer();
        this.spotifyHandler = new SpotifyHandler();
        this.youtubeHandler = new YouTubeHandler();
        this.currentConnection = null;
        this.currentMessage = null;
        this.preprocessedTracks = new Map();
        this.isPreprocessing = false;
        this.processingQueue = new Set();

        this.player.on('error', (error) => {
            logger.error('Error in audio player:', error);
            this.playNext(this.currentConnection, this.currentMessage);
        });

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.playNext(this.currentConnection, this.currentMessage);
        });
    }

    async play(message, query) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('Você precisa estar em um canal de voz para tocar música!');
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

            // Verifica se é uma playlist
            if (query.includes('playlist')) {
                await this.handlePlaylist(message, query);
                return;
            }

            const trackInfo = { query, requester: message.author.id };
            serverQueue.push(trackInfo);

            this.startPreprocessing(message.guild.id, trackInfo);

            if (serverQueue.length === 1 && this.player.state.status !== AudioPlayerStatus.Playing) {
                this.currentMessage = message;
                await this.playNext(this.currentConnection, message);
            } else {
                message.reply(`Adicionado à fila: ${query}`);
            }
        } catch (error) {
            logger.error('Erro ao tentar tocar música:', error);
            message.reply('Ocorreu um erro ao tentar tocar a música. Por favor, tente novamente.');
        }
    }

    async handlePlaylist(message, playlistUrl) {
        try {
            const trackUrls = await this.youtubeHandler.getPlaylistTracks(playlistUrl);
            const serverQueue = this.queue.get(message.guild.id);
            
            for (const trackUrl of trackUrls) {
                const trackInfo = { query: trackUrl, requester: message.author.id };
                serverQueue.push(trackInfo);
                this.startPreprocessing(message.guild.id, trackInfo);
            }

            message.reply(`Adicionadas ${trackUrls.length} músicas à fila da playlist.`);
            if (serverQueue.length === trackUrls.length && this.player.state.status !== AudioPlayerStatus.Playing) {
                this.currentMessage = message;
                await this.playNext(this.currentConnection, message);
            }
        } catch (error) {
            logger.error('Erro ao lidar com a playlist:', error);
            message.reply('Ocorreu um erro ao tentar processar a playlist. Verifique o link e tente novamente.');
        }
    }

    async downloadAndConvertAudio(url, outputPath) {
        return new Promise((resolve, reject) => {
            const stream = ytdl(url, {
                filter: 'audioonly',
                quality: 'highestaudio',
            });

            ffmpeg(stream)
                .audioBitrate(320)
                .save(outputPath)
                .on('end', () => {
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    reject(err);
                });
        });
    }

    async startPreprocessing(guildId, trackInfo) {
        const trackKey = `${guildId}-${trackInfo.query}`;
        
        if (this.preprocessedTracks.has(trackKey) || this.processingQueue.has(trackKey)) {
            return;
        }

        this.processingQueue.add(trackKey);
        
        try {
            logger.info(`Iniciando pré-processamento para: ${trackInfo.query}`);
            await this.preprocessTrack(guildId, trackInfo);
        } catch (error) {
            logger.error(`Erro no pré-processamento de ${trackInfo.query}:`, error);
        } finally {
            this.processingQueue.delete(trackKey);
        }
    }

    async preprocessTrack(guildId, trackInfo) {
        const trackKey = `${guildId}-${trackInfo.query}`;

        try {
            let videoUrl;
            let songInfo;

            if (trackInfo.query.includes('open.spotify.com')) {
                const spotifyInfo = await this.spotifyHandler.getTrackInfo(trackInfo.query);
                videoUrl = await this.youtubeHandler.search(`${spotifyInfo.name} ${spotifyInfo.artists}`);
                songInfo = {
                    title: spotifyInfo.name || 'Unknown Title',
                    author: spotifyInfo.artists || 'Unknown',
                    duration: spotifyInfo.duration ? Utils.formatDuration(spotifyInfo.duration) : 'Unknown',
                    thumbnail: spotifyInfo.albumCover || null,
                };
            } else {
                videoUrl = await this.youtubeHandler.search(trackInfo.query);
                const videoDetails = (await ytdl.getInfo(videoUrl)).videoDetails;
                songInfo = {
                    title: videoDetails.title || 'Unknown Title',
                    author: videoDetails.author.name || 'Unknown',
                    duration: videoDetails.lengthSeconds ? Utils.formatDuration(videoDetails.lengthSeconds) : 'Unknown',
                    thumbnail: videoDetails.thumbnails?.[0]?.url || null,
                };
            }

            const preprocessedData = {
                videoUrl,
                songInfo,
                timestamp: Date.now(),
            };

            if (config.useFFmpeg) {
                const outputDirectory = path.join(__dirname, '../../ffmpeg_tmp');
                const outputPath = path.join(outputDirectory, `${songInfo.title.replace(/[\\/:*?"<>|]/g, '')}.mp3`);

                if (!fs.existsSync(outputDirectory)) {
                    fs.mkdirSync(outputDirectory, { recursive: true });
                }

                if (!fs.existsSync(outputPath)) {
                    logger.info(`Iniciando download para: ${songInfo.title}`);
                    await this.downloadAndConvertAudio(videoUrl, outputPath);
                    logger.info(`Download concluído: ${songInfo.title}`);
                    preprocessedData.filePath = outputPath;
                } else {
                    preprocessedData.filePath = outputPath;
                }
            } else {
                preprocessedData.streamOptions = {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    highWaterMark: 1 << 25,
                };
            }

            this.preprocessedTracks.set(trackKey, preprocessedData);
            logger.info(`Pré-processamento concluído para: ${songInfo.title}`);

        } catch (error) {
            logger.error(`Erro ao pré-processar música: ${trackInfo.query}`, error);
            throw error;
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
            this.cleanup(guildId);
            return;
        }

        const song = serverQueue[0];
        const trackKey = `${guildId}-${song.query}`;
        
        try {
            const preprocessedData = this.preprocessedTracks.get(trackKey);
            
            if (preprocessedData) {
                const resource = config.useFFmpeg && preprocessedData.filePath
                    ? createAudioResource(preprocessedData.filePath)
                    : createAudioResource(ytdl(preprocessedData.videoUrl, preprocessedData.streamOptions));

                this.player.play(resource);
                this.sendNowPlayingEmbed(message, preprocessedData.songInfo, preprocessedData.videoUrl, song.requester);
            } else {
                let videoUrl;
                let songInfo;

                if (song.query.includes('open.spotify.com')) {
                    const trackInfo = await this.spotifyHandler.getTrackInfo(song.query);
                    videoUrl = await this.youtubeHandler.search(`${trackInfo.name} ${trackInfo.artists}`);
                    songInfo = {
                        title: trackInfo.name || 'Unknown Title',
                        author: trackInfo.artists || 'Unknown',
                        duration: trackInfo.duration ? Utils.formatDuration(trackInfo.duration) : 'Unknown',
                        thumbnail: trackInfo.albumCover || null,
                    };
                } else {
                    videoUrl = await this.youtubeHandler.search(song.query);
                    const videoDetails = (await ytdl.getInfo(videoUrl)).videoDetails;
                    songInfo = {
                        title: videoDetails.title || 'Unknown Title',
                        author: videoDetails.author.name || 'Unknown',
                        duration: videoDetails.lengthSeconds ? Utils.formatDuration(videoDetails.lengthSeconds) : 'Unknown',
                        thumbnail: videoDetails.thumbnails?.[0]?.url || null,
                    };
                }

                if (config.useFFmpeg) {
                    const outputDirectory = path.join(__dirname, '../../ffmpeg_tmp');
                    const outputPath = path.join(outputDirectory, `${songInfo.title.replace(/[\\/:*?"<>|]/g, '')}.mp3`);

                    if (!fs.existsSync(outputDirectory)) {
                        fs.mkdirSync(outputDirectory, { recursive: true });
                    }

                    await this.downloadAndConvertAudio(videoUrl, outputPath);
                    const resource = createAudioResource(outputPath);
                    this.player.play(resource);
                } else {
                    const resource = createAudioResource(ytdl(videoUrl, { filter: 'audioonly' }));
                    this.player.play(resource);
                }

                this.sendNowPlayingEmbed(message, songInfo, videoUrl, song.requester);
            }

            serverQueue.shift();
        } catch (error) {
            logger.error('Erro ao tocar próxima música:', error);
            message.reply('Ocorreu um erro ao tentar tocar a próxima música.');
        }
    }

    stop(message) {
        const guildId = message.guild.id;
        const serverQueue = this.queue.get(guildId);
    
        if (serverQueue) {
            serverQueue.length = 0;
            this.queue.delete(guildId);
        }
    
        const connection = getVoiceConnection(guildId);
        if (connection && !connection.state.status === 'destroyed') {
            connection.destroy();
        }
    
        this.player.stop(true);
        this.cleanup(guildId);
    
        message.channel.send('Reprodução parada e fila limpa.');
    }

    skip(message) {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) {
            return message.reply('Não estou tocando nenhuma música no momento.');
        }

        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue || serverQueue.length === 0) {
            return message.reply('Não há músicas na fila para tocar.');
        }

        this.player.stop();
        message.reply('Música pulada!');
    }

    cleanOldPreprocessedTracks() {
        const ONE_HOUR = 3600000;
        const now = Date.now();

        for (const [key, data] of this.preprocessedTracks.entries()) {
            if (now - data.timestamp > ONE_HOUR) {
                if (data.filePath && fs.existsSync(data.filePath)) {
                    try {
                        fs.unlinkSync(data.filePath);
                    } catch (error) {
                        logger.error('Error removing old preprocessed file:', error);
                    }
                }
                this.preprocessedTracks.delete(key);
            }
        }
    }

    sendNowPlayingEmbed(message, songInfo, videoUrl, requesterId) {
        const embed = new EmbedBuilder()
            .setColor(Colors.Gold)
            .setTitle(`Tocando agora: ${songInfo.title}`)
            .setURL(videoUrl)
            .setDescription(`**Solicitado por:** <@${requesterId}>`)
            .setThumbnail(songInfo.thumbnail)
            .addFields(
                { name: 'Artista', value: songInfo.author, inline: true },
                { name: 'Duração', value: songInfo.duration, inline: true }
            )
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }

    cleanup(guildId) {
        if (this.queue.has(guildId)) {
            this.queue.delete(guildId);
        }

        const connection = getVoiceConnection(guildId);
        if (connection) {
            connection.destroy();
        }
    }
}

module.exports = MusicPlayer;
