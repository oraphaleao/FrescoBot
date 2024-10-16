const search = require('youtube-search');
const config = require('../../config/config');
const logger = require('../utils/logger');

class YouTubeHandler {
    constructor() {
        this.opts = {
            maxResults: 1,
            key: config.YOUTUBE_API_KEY
        };
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
}

module.exports = YouTubeHandler;