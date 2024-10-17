const search = require('youtube-search');
const { google } = require('googleapis'); // Importando o Google APIs
const config = require('../../config/config');
const logger = require('../utils/logger');

class YouTubeHandler {
    constructor() {
        this.opts = {
            maxResults: 1,
            key: config.YOUTUBE_API_KEY
        };
        this.youtube = google.youtube({
            version: 'v3',
            auth: config.YOUTUBE_API_KEY // Usando a mesma chave de API
        });
    }

    async search(query) {
        logger.info(`Searching YouTube with query: ${query}`);
        try {
            const results = await search(query, this.opts);
            logger.info('YouTube search results:', results); // Log de debug para os resultados da pesquisa
            if (results && results.results && results.results.length > 0) {
                logger.info(`Found on YouTube: ${results.results[0].link}`);
                return results.results[0].link; // Retorna o link do vídeo
            } else {
                logger.warn('No results found for the query.');
                return null; // Retorna null se não houver resultados
            }
        } catch (error) {
            logger.error('Error searching YouTube:', error);
            return null; // Retorna null em caso de erro
        }
    }

    async getPlaylistTracks(playlistId) {
        logger.info(`Fetching tracks for playlist ID: ${playlistId}`);
        try {
            const response = await this.youtube.playlistItems.list({
                part: 'snippet',
                playlistId: playlistId,
                maxResults: 50, // Ajuste conforme necessário
            });
    
            const tracks = response.data.items.map(item => ({
                title: item.snippet.title,
                url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
            }));
    
            logger.info(`Fetched ${tracks.length} tracks from the playlist.`);
            return tracks;
        } catch (error) {
            logger.error(`Error fetching playlist tracks for ID ${playlistId}:`, error);
            return []; // Retorna um array vazio em caso de erro
        }
    }
}

module.exports = YouTubeHandler;
