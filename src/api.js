const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const logger = require('./utils/logger');

class BotAPI {
    constructor(whatsappClient, conversationService, accountService) {
        this.app = express();
        this.whatsappClient = whatsappClient;
        this.conversationService = conversationService;
        this.accountService = accountService;
        this.qrCode = null;
        this.botStatus = 'stopped';

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());

        // Simple API key authentication
        this.app.use((req, res, next) => {
            const apiKey = req.headers['x-api-key'];
            if (apiKey !== process.env.BOT_API_KEY && process.env.BOT_API_KEY) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            next();
        });
    }

    setupRoutes() {
        // Bot Status
        this.app.get('/api/bot/status', (req, res) => {
            res.json({
                status: this.botStatus,
                connected: this.whatsappClient?.info ? true : false,
                phone: this.whatsappClient?.info?.wid?.user || null,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });

        // Get QR Code for login
        this.app.get('/api/bot/qr', (req, res) => {
            if (this.qrCode) {
                res.json({ qr: this.qrCode, status: 'waiting_scan' });
            } else if (this.botStatus === 'connected') {
                res.json({ qr: null, status: 'already_connected' });
            } else {
                res.json({ qr: null, status: 'not_available' });
            }
        });

        // Start Bot
        this.app.post('/api/bot/start', async (req, res) => {
            try {
                if (this.botStatus === 'running' || this.botStatus === 'connected') {
                    return res.json({ success: false, message: 'Bot already running' });
                }

                this.botStatus = 'starting';
                // The actual start is handled by index.js
                res.json({ success: true, message: 'Bot starting...' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Stop Bot
        this.app.post('/api/bot/stop', async (req, res) => {
            try {
                if (this.whatsappClient) {
                    await this.whatsappClient.destroy();
                    this.botStatus = 'stopped';
                    res.json({ success: true, message: 'Bot stopped' });
                } else {
                    res.json({ success: false, message: 'Bot not running' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get Accounts Stock
        this.app.get('/api/accounts', (req, res) => {
            const stock = this.accountService.getStockStatus();
            res.json(stock);
        });

        // Get Accounts for specific product
        this.app.get('/api/accounts/:productId', (req, res) => {
            const { productId } = req.params;
            const count = this.accountService.getAvailableCount(productId);
            const product = config.products.find(p => p.id === productId);

            res.json({
                productId,
                productName: product?.name || 'Unknown',
                available: count
            });
        });

        // Add Accounts
        this.app.post('/api/accounts/:productId', (req, res) => {
            try {
                const { productId } = req.params;
                const { accounts } = req.body;

                if (!accounts || !Array.isArray(accounts)) {
                    return res.status(400).json({ error: 'Accounts array required' });
                }

                // Parse accounts (support both object format and string format)
                const parsedAccounts = accounts.map(acc => {
                    if (typeof acc === 'string') {
                        const [email, password] = acc.split(':');
                        return { email: email?.trim(), password: password?.trim(), remark: '' };
                    }
                    return acc;
                }).filter(acc => acc.email && acc.password);

                if (parsedAccounts.length === 0) {
                    return res.status(400).json({ error: 'No valid accounts provided' });
                }

                const success = this.accountService.addAccounts(productId, parsedAccounts);

                if (success) {
                    logger.info(`API: Added ${parsedAccounts.length} accounts to ${productId}`);
                    res.json({
                        success: true,
                        added: parsedAccounts.length,
                        newTotal: this.accountService.getAvailableCount(productId)
                    });
                } else {
                    res.status(400).json({ error: 'Failed to add accounts' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get Recent Sales (from memory - for real persistence use Firebase)
        this.app.get('/api/sales', (req, res) => {
            // This would come from Firebase in production
            res.json({ sales: [], message: 'Use Firebase for persistent sales data' });
        });

        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ healthy: true, timestamp: new Date().toISOString() });
        });
    }

    setQRCode(qr) {
        this.qrCode = qr;
        this.botStatus = 'waiting_qr';
    }

    clearQRCode() {
        this.qrCode = null;
    }

    setConnected() {
        this.qrCode = null;
        this.botStatus = 'connected';
    }

    setDisconnected() {
        this.botStatus = 'disconnected';
    }

    start(port = 3001) {
        this.app.listen(port, '0.0.0.0', () => {
            logger.info(`🌐 Bot API running on http://0.0.0.0:${port}`);
        });
    }
}

module.exports = BotAPI;
