const SpotifyWebApi = require('spotify-web-api-node');
const config = require('../../config/config');
const logger = require('../utils/logger');

class SpotifyHandler {
    constructor() {
        this.spotifyApi = new SpotifyWebApi({
            clientId: config.SPOTIFY_CLIENT_ID,
            clientSecret: config.SPOTIFY_CLIENT_SECRET
        });

        this.initializeSpotifyApi();
    }

    async initializeSpotifyApi() {
        try {
            const data = await this.spotifyApi.clientCredentialsGrant();
            logger.info('Spotify access token acquired');
            this.spotifyApi.setAccessToken(data.body['access_token']);
        } catch (err) {
            logger.error('Error getting Spotify access token', err);
        }
    }

    async getTrackInfo(spotifyUrl) {
        const trackId = spotifyUrl.split('/').pop().split('?')[0];
        try {
            const track = await this.spotifyApi.getTrack(trackId);
            return {
                name: track.body.name,
                artists: track.body.artists.map(artist => artist.name).join(', '),
                duration: track.body.duration_ms,
                albumCover: track.body.album.images[0].url
            };
        } catch (error) {
            logger.error('Error fetching Spotify track:', error);
            throw error;
        }
    }
}

module.exports = SpotifyHandler;