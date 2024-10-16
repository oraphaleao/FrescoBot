const MusicBot = require('./src/bot/MusicBot');
const config = require('./config/config');

const bot = new MusicBot(config.BOT_TOKEN);
bot.login();