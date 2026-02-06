/**
 * ABONNEMENT.TN WhatsApp Auto-Respond Bot
 * 
 * This bot automatically handles customer conversations on WhatsApp:
 * - Answers questions about products
 * - Guides customers through the purchase flow
 * - Verifies payment screenshots using AI
 * - Delivers subscription accounts automatically
 */

require('dotenv').config();

const config = require('./config/config');
const logger = require('./utils/logger');
const aiService = require('./services/ai.service');
const firebaseService = require('./services/firebase.service');
const accountService = require('./services/account.service');
const whatsappHandler = require('./platforms/whatsapp.handler');
const conversationService = require('./services/conversation.service');
const BotAPI = require('./api');

// Banner
console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     █████╗ ██████╗  ██████╗ ███╗   ██╗███╗   ██╗███████╗ ║
║    ██╔══██╗██╔══██╗██╔═══██╗████╗  ██║████╗  ██║██╔════╝ ║
║    ███████║██████╔╝██║   ██║██╔██╗ ██║██╔██╗ ██║█████╗   ║
║    ██╔══██║██╔══██╗██║   ██║██║╚██╗██║██║╚██╗██║██╔══╝   ║
║    ██║  ██║██████╔╝╚██████╔╝██║ ╚████║██║ ╚████║███████╗ ║
║    ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝╚══════╝ ║
║                                                           ║
║              ABONNEMENT.TN WhatsApp Bot                   ║
║                     v1.0.0                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

/**
 * Main startup function
 */
async function main() {
    logger.info('Starting ABONNEMENT.TN Bot...');

    // Check configuration
    const geminiKey = config.gemini?.apiKey || process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'your_gemini_api_key_here') {
        logger.error('❌ Gemini API key not configured!');
        logger.error('Please set GEMINI_API_KEY in .env file');
        process.exit(1);
    }

    // Initialize services
    logger.info('Initializing services...');

    // Initialize Gemini AI
    const aiInitialized = aiService.initialize();
    if (!aiInitialized) {
        logger.error('❌ Failed to initialize AI service');
        process.exit(1);
    }

    // Initialize Firebase (optional - bot works offline too)
    await firebaseService.initialize();

    // Check account stock
    const stockStatus = accountService.getStockStatus();
    logger.info('📦 Account Stock Status:');
    for (const [productId, status] of Object.entries(stockStatus)) {
        logger.info(`   ${status.name}: ${status.available} accounts available`);
        if (status.available === 0) {
            logger.warn(`   ⚠️ No accounts available for ${status.name}!`);
        }
    }

    // Start WhatsApp client
    logger.info('Starting WhatsApp client...');
    const client = await whatsappHandler.initialize();

    // Start API server for remote control
    const botAPI = new BotAPI(client, conversationService, accountService);

    // Hook up QR code events
    if (client) {
        client.on('qr', (qr) => {
            botAPI.setQRCode(qr);
            logger.info('🔐 QR code available via API at /api/bot/qr');
        });

        client.on('ready', () => {
            botAPI.setConnected();
        });

        client.on('disconnected', () => {
            botAPI.setDisconnected();
        });
    }

    // Start API on port 3001
    const apiPort = process.env.API_PORT || 3001;
    botAPI.start(apiPort);

    // Cleanup old conversations periodically
    setInterval(() => {
        conversationService.cleanupOldConversations();
    }, 60 * 60 * 1000); // Every hour

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('Shutting down...');
        await whatsappHandler.disconnect();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('Shutting down...');
        await whatsappHandler.disconnect();
        process.exit(0);
    });
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
