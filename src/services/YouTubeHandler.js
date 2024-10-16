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
            if (results && results.results && results.results.length > 0) {
                logger.info(`Found on YouTube: ${results.results[0].link}`);
                return results.results[0].link;
            } else {
                logger.warn('No results found for the query.');
            }
        } catch (error) {
            logger.error('Error searching YouTube:', error);
        }
        return null;
    }
}

module.exports = YouTubeHandler;