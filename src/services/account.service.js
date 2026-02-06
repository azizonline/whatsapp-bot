const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

class AccountService {
    constructor() {
        this.accountsPath = config.paths.accounts;
        this.deliveredPath = config.paths.delivered;
        this.ensureDirectories();
    }

    /**
     * Ensure data directories exist
     */
    ensureDirectories() {
        [this.accountsPath, this.deliveredPath].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Parse accounts from a txt file
     * @param {string} content - File content
     * @returns {Array} Array of account objects
     */
    parseAccounts(content) {
        const accounts = [];
        const blocks = content.split('-----------------------------------------------------');

        for (const block of blocks) {
            const trimmed = block.trim();
            if (!trimmed) continue;

            const lines = trimmed.split('\n');
            const account = {};

            for (const line of lines) {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join(':').trim();
                    account[key.trim().toLowerCase()] = value;
                }
            }

            if (account.account && account.password) {
                accounts.push({
                    email: account.account,
                    password: account.password,
                    remark: account.remark || '',
                });
            }
        }

        return accounts;
    }

    /**
     * Get available accounts for a product
     * @param {string} productId - Product ID
     * @returns {Array} Available accounts
     */
    getAvailableAccounts(productId) {
        const product = config.products.find(p => p.id === productId);
        if (!product) {
            logger.error(`Product not found: ${productId}`);
            return [];
        }

        // Products without accountsFile don't have ready accounts (they need buyer email/credentials)
        if (!product.accountsFile) {
            return [];
        }

        const filePath = path.join(this.accountsPath, product.accountsFile);

        if (!fs.existsSync(filePath)) {
            logger.warn(`Accounts file not found: ${filePath}`);
            return [];
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return this.parseAccounts(content);
    }

    /**
     * Get the count of available accounts for a product
     * @param {string} productId - Product ID
     * @returns {number} Number of available accounts
     */
    getAvailableCount(productId) {
        return this.getAvailableAccounts(productId).length;
    }

    /**
     * Get one account and remove it from the file
     * @param {string} productId - Product ID
     * @returns {Object|null} Account object or null if none available
     */
    getAndRemoveAccount(productId) {
        const product = config.products.find(p => p.id === productId);
        if (!product) {
            logger.error(`Product not found: ${productId}`);
            return null;
        }

        const filePath = path.join(this.accountsPath, product.accountsFile);

        if (!fs.existsSync(filePath)) {
            logger.warn(`Accounts file not found: ${filePath}`);
            return null;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const accounts = this.parseAccounts(content);

        if (accounts.length === 0) {
            logger.warn(`No accounts available for: ${productId}`);
            return null;
        }

        // Take the first account
        const account = accounts[0];
        const remainingAccounts = accounts.slice(1);

        // Write remaining accounts back to file
        const newContent = remainingAccounts.map(acc =>
            `Account: ${acc.email}\nPassword: ${acc.password}\nRemark: ${acc.remark}\n-----------------------------------------------------`
        ).join('\n');

        fs.writeFileSync(filePath, newContent, 'utf-8');

        // Log the delivered account
        this.logDeliveredAccount(productId, account);

        logger.info(`Account delivered for ${productId}: ${account.email}`);
        return account;
    }

    /**
     * Log delivered account to delivered folder
     * @param {string} productId - Product ID
     * @param {Object} account - Account object
     */
    logDeliveredAccount(productId, account) {
        const deliveredFile = path.join(this.deliveredPath, `${productId}-delivered.txt`);
        const timestamp = new Date().toISOString();

        const entry = `[${timestamp}]\nAccount: ${account.email}\nPassword: ${account.password}\nRemark: ${account.remark}\n-----------------------------------------------------\n`;

        fs.appendFileSync(deliveredFile, entry, 'utf-8');
    }

    /**
     * Add accounts to a product file
     * @param {string} productId - Product ID
     * @param {Array} accounts - Array of account objects
     */
    addAccounts(productId, accounts) {
        const product = config.products.find(p => p.id === productId);
        if (!product) {
            logger.error(`Product not found: ${productId}`);
            return false;
        }

        const filePath = path.join(this.accountsPath, product.accountsFile);

        const newContent = accounts.map(acc =>
            `Account: ${acc.email}\nPassword: ${acc.password}\nRemark: ${acc.remark || product.remark}\n-----------------------------------------------------`
        ).join('\n');

        // Append to existing file or create new
        if (fs.existsSync(filePath)) {
            const existingContent = fs.readFileSync(filePath, 'utf-8').trim();
            if (existingContent) {
                fs.writeFileSync(filePath, existingContent + '\n' + newContent, 'utf-8');
            } else {
                fs.writeFileSync(filePath, newContent, 'utf-8');
            }
        } else {
            fs.writeFileSync(filePath, newContent, 'utf-8');
        }

        logger.info(`Added ${accounts.length} accounts to ${productId}`);
        return true;
    }

    /**
     * Get stock status for all products
     * @returns {Object} Stock status
     */
    getStockStatus() {
        const status = {};
        for (const product of config.products) {
            status[product.id] = {
                name: product.name,
                available: this.getAvailableCount(product.id),
                price: product.priceTND,
            };
        }
        return status;
    }
}

module.exports = new AccountService();
