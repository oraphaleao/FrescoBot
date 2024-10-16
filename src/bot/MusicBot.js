const { Client, GatewayIntentBits } = require('discord.js');
const MusicPlayer = require('../services/MusicPlayer');
const config = require('../../config/config');
const logger = require('../utils/logger');

class MusicBot {
    constructor(token) {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });
        this.token = token;
        this.prefix = config.PREFIX;
        this.musicPlayer = new MusicPlayer();

        this.client.on('ready', () => {
            logger.info(`Logged in as ${this.client.user.tag}!`);
        });

        this.client.on('messageCreate', this.handleMessage.bind(this));
    }

    login() {
        this.client.login(this.token).catch(error => {
            logger.error('Failed to login:', error);
            process.exit(1); // Exit the process if login fails
        });
    }

    async handleMessage(message) {
        if (!message.content.startsWith(this.prefix) || message.author.bot) return;

        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        try {
            const commandModule = require(`./commands/${command}`);
            await commandModule.execute(message, args, this.musicPlayer);
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                logger.warn(`Command not found: ${command}`);
                message.reply('That command does not exist.');
            } else {
                logger.error(`Error executing command ${command}:`, error);
                message.reply('There was an error trying to execute that command!');
            }
        }
    }
}

module.exports = MusicBot;