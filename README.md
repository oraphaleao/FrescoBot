# FrescoBot
Bot para discord simples e pessoal para escutar música do Youtube/Spotify

## Setting up

1. Set up your very own discord bot using this [tutorial](https://tinyurl.com/bdewbdxk).
2. We gonna need of `Spotify Keys` too, well, follow steps from their [tutorial](https://developer.spotify.com/documentation/web-api/tutorials/getting-started).
3. And for the last, you will gonna need the most important key, the `Youtube API Key`, for this you prompt the ChatGPT this: `How can I get the YouTube API Key?` and follow the steps.
4. Rename the `config.js.example` to `config.js` located at `/config` and fill with the requested keys.
5. For the last, run: `npm init` and `npm install @discordjs/voice @distube/ytdl-core discord.js spotify-web-api-node tweetnacl winston youtube-search`.
6. To start the bot run `node index.js`.

## Overview of Functionality

The bot currently supports playing songs from Spotify and YouTube, however, if you enter the Spotify link for example, it will acquire all the information about the song to do a search on YouTube to be able to play the entire song, since playing entire songs from Spotify is entirely illegal and against the privacy and usage rights of the same.

### Commands with examples

The bot currently supports the following commands, using the prefix `!!` (configurable) in a text channel:
- `!!play <YouTube video id/url, YouTube search arguments or Spotify track, album>` -- Adds song (or collection of songs) to the queue. If given a YouTube video url, or Spotify track url, that video/track will be played. If given YouTube search arguments, the first video from a YouTube search will be played.
- `!!stop` -- Completely stops the audio player, with an error message if nothing is playing. Also clears the queue.
- `!!skip` -- Skips the song currently playing and plays the next one in the queue.

## Future work

- Add more commands;
- Improve play structure and put the feature of download the music and play it with ffmpeg;
- Improve the bot to recognize playlists (Doesn't matter if it's from Youtube or Spotify);
- Improve Rich Presence of it;
- Add Embed information of actual music;
- Improve interaction of Bot between music and user;
- Expand the options and put others supported plataforms to it;
- Much more...

## Contact

If you wanna help this project or just chat, contact me at Discord: oraphaleao

See you soon <3
