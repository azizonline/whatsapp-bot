const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('../config/config');
const conversationService = require('../services/conversation.service');
const logger = require('../utils/logger');

class WhatsAppHandler {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.processedMessages = new Set(); // Track processed message IDs to prevent duplicates
    }

    /**
     * Initialize WhatsApp client
     */
    async initialize() {
        logger.info('Initializing WhatsApp client...');

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: config.paths.sessions,
            }),
            puppeteer: {
                headless: true,  // Must be true for cloud/Docker (no display)
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--disable-gpu',
                    '--single-process',
                    '--no-zygote',
                ],
            },
        });

        this.setupEventHandlers();

        await this.client.initialize();

        return this.client; // Return client for API integration
    }

    /**
     * Set up event handlers
     */
    setupEventHandlers() {
        // QR Code event
        this.client.on('qr', (qr) => {
            logger.info('QR Code received. Scan it with WhatsApp:');
            console.log('\n');
            qrcode.generate(qr, { small: true });
            console.log('\n');
            logger.info('Waiting for QR code scan...');
        });

        // Ready event
        this.client.on('ready', () => {
            this.isReady = true;
            logger.info('✅ WhatsApp client is ready!');
            logger.info(`Logged in as: ${this.client.info.pushname}`);
        });

        // Authentication success
        this.client.on('authenticated', () => {
            logger.info('WhatsApp authenticated successfully');
        });

        // Authentication failure
        this.client.on('auth_failure', (msg) => {
            logger.error('WhatsApp authentication failed:', msg);
        });

        // Disconnected
        this.client.on('disconnected', (reason) => {
            this.isReady = false;
            logger.warn('WhatsApp disconnected:', reason);
        });

        // Message received (handles all incoming messages including media)
        this.client.on('message', async (message) => {
            // Skip if we already processed this message
            if (this.processedMessages.has(message.id._serialized)) {
                return;
            }
            this.processedMessages.add(message.id._serialized);

            // Cleanup old message IDs (keep last 100)
            if (this.processedMessages.size > 100) {
                const iterator = this.processedMessages.values();
                this.processedMessages.delete(iterator.next().value);
            }

            await this.handleMessage(message);
        });
    }

    /**
     * Handle incoming message
     */
    async handleMessage(message) {
        try {
            // Ignore group messages
            if (message.from.includes('@g.us')) {
                return;
            }

            // Ignore status updates
            if (message.from === 'status@broadcast') {
                return;
            }

            // Check working hours (if enabled)
            if (config.bot.workingHours.enabled && !this.isWithinWorkingHours()) {
                logger.info(`Message received outside working hours from: ${message.from}`);
                return;
            }

            const customerId = message.from;
            const messageText = message.body || '';

            logger.info(`📩 Message from ${customerId}: "${messageText.substring(0, 50)}..."`);

            // Handle media (payment screenshots)
            let mediaData = null;
            if (message.hasMedia) {
                try {
                    const media = await message.downloadMedia();
                    if (media && media.mimetype.startsWith('image/')) {
                        mediaData = {
                            buffer: Buffer.from(media.data, 'base64'),
                            mimetype: media.mimetype,
                        };
                        logger.info(`📷 Image received from ${customerId}`);
                    }
                } catch (error) {
                    logger.error('Failed to download media:', error.message);
                }
            }

            // Process message through conversation service
            const response = await conversationService.processMessage(
                customerId,
                messageText,
                'whatsapp',
                mediaData
            );

            // Add human-like delay
            await this.humanDelay();

            // Show typing indicator
            const chat = await message.getChat();
            await chat.sendStateTyping();

            // Calculate typing time based on response length
            const typingTime = Math.min(response.text.length * 30, 3000);
            await this.delay(typingTime);

            // Send response
            await chat.clearState();
            await message.reply(response.text);

            logger.info(`📤 Replied to ${customerId}`);

        } catch (error) {
            logger.error('Error handling message:', error);
        }
    }

    /**
     * Check if current time is within working hours
     */
    isWithinWorkingHours() {
        const now = new Date();
        const hour = now.getHours();
        return hour >= config.bot.workingHours.start && hour < config.bot.workingHours.end;
    }

    /**
     * Add human-like delay
     */
    async humanDelay() {
        const { min, max } = config.bot.responseDelay;
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await this.delay(delay);
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Send a message to a specific number
     * @param {string} phoneNumber - Phone number with country code
     * @param {string} message - Message to send
     */
    async sendMessage(phoneNumber, message) {
        if (!this.isReady) {
            logger.error('WhatsApp client not ready');
            return false;
        }

        try {
            // Format phone number
            const chatId = phoneNumber.includes('@c.us')
                ? phoneNumber
                : `${phoneNumber.replace(/[^0-9]/g, '')}@c.us`;

            await this.client.sendMessage(chatId, message);
            logger.info(`Message sent to ${phoneNumber}`);
            return true;
        } catch (error) {
            logger.error('Failed to send message:', error.message);
            return false;
        }
    }

    /**
     * Get client status
     */
    getStatus() {
        return {
            isReady: this.isReady,
            info: this.isReady ? this.client.info : null,
        };
    }

    /**
     * Disconnect client
     */
    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.isReady = false;
            logger.info('WhatsApp client disconnected');
        }
    }
}

module.exports = new WhatsAppHandler();
