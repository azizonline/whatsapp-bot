const admin = require('firebase-admin');
const config = require('../config/config');
const logger = require('../utils/logger');

class FirebaseService {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    /**
     * Initialize Firebase Admin SDK
     */
    async initialize() {
        if (this.initialized) return;

        try {
            const fs = require('fs');
            const path = require('path');

            // Use absolute path to project root
            const projectRoot = path.resolve(__dirname, '../..');
            const serviceAccountPath = path.join(projectRoot, 'firebase-serviceAccount.json');

            if (!fs.existsSync(serviceAccountPath)) {
                logger.warn('Firebase service account not found. Running in offline mode.');
                logger.warn(`Please download service account from Firebase Console and save to: ${serviceAccountPath}`);
                return;
            }

            const serviceAccount = require(serviceAccountPath);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: config.firebase.projectId,
            });

            this.db = admin.firestore();
            this.initialized = true;
            logger.info('Firebase initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Firebase:', error.message);
        }
    }

    /**
     * Check if Firebase is available
     */
    isAvailable() {
        return this.initialized && this.db !== null;
    }

    /**
     * Record a sale in Firebase (compatible with ABONNEMENT.TN app)
     * @param {Object} saleData - Sale data
     */
    async recordSale(saleData) {
        if (!this.isAvailable()) {
            logger.warn('Firebase not available. Sale not recorded to cloud.');
            return null;
        }

        try {
            const now = new Date().toISOString();

            // Format compatible with ABONNEMENT.TN Flutter app
            const sale = {
                id: this.generateId(),
                date: now,
                productName: saleData.productName,
                customerName: saleData.customerName,
                amountReceivedUSD: this.tndToUsd(saleData.amountTND),
                amountSpentUSD: this.tndToUsd(saleData.costTND || 0),
                paymentStatus: 1, // 1 = paid (from Flutter app enum)
                createdAt: now,
                updatedAt: now,
                // Additional bot-specific data
                platform: saleData.platform || 'whatsapp',
                paymentMethod: saleData.paymentMethod,
                customerPhone: saleData.customerPhone,
                accountDelivered: saleData.accountEmail,
                automatedSale: true,
            };

            const docRef = await this.db.collection('sales').add(sale);
            logger.info(`Sale recorded to Firebase: ${docRef.id}`);

            return docRef.id;
        } catch (error) {
            logger.error('Failed to record sale:', error.message);
            return null;
        }
    }

    /**
     * Convert TND to USD (approximate rate)
     * @param {number} tnd - Amount in TND
     */
    tndToUsd(tnd) {
        const rate = 0.32; // Approximate TND to USD rate
        return Math.round(tnd * rate * 100) / 100;
    }

    /**
     * Generate a UUID-like ID
     */
    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Log conversation to Firebase
     * @param {Object} conversationData - Conversation data
     */
    async logConversation(conversationData) {
        if (!this.isAvailable()) return null;

        try {
            const docRef = await this.db.collection('conversations').add({
                ...conversationData,
                createdAt: new Date().toISOString(),
            });
            return docRef.id;
        } catch (error) {
            logger.error('Failed to log conversation:', error.message);
            return null;
        }
    }

    /**
     * Update conversation in Firebase
     * @param {string} conversationId - Conversation ID
     * @param {Object} data - Update data
     */
    async updateConversation(conversationId, data) {
        if (!this.isAvailable()) return;

        try {
            await this.db.collection('conversations').doc(conversationId).update({
                ...data,
                updatedAt: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Failed to update conversation:', error.message);
        }
    }

    /**
     * Get today's sales statistics
     */
    async getTodayStats() {
        if (!this.isAvailable()) return null;

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const snapshot = await this.db.collection('sales')
                .where('createdAt', '>=', today.toISOString())
                .get();

            let totalRevenue = 0;
            let totalProfit = 0;
            let count = 0;

            snapshot.forEach(doc => {
                const sale = doc.data();
                totalRevenue += sale.amountReceivedUSD || 0;
                totalProfit += (sale.amountReceivedUSD || 0) - (sale.amountSpentUSD || 0);
                count++;
            });

            return {
                salesCount: count,
                totalRevenue,
                totalProfit,
            };
        } catch (error) {
            logger.error('Failed to get stats:', error.message);
            return null;
        }
    }
}

module.exports = new FirebaseService();
