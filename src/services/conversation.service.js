const config = require('../config/config');
const aiService = require('./ai.service');
const accountService = require('./account.service');
const firebaseService = require('./firebase.service');
const logger = require('../utils/logger');

const ConversationState = {
    IDLE: 'idle',
    CHATTING: 'chatting',
    AWAITING_PAYMENT: 'awaiting_payment',
    COMPLETED: 'completed',
};

class ConversationService {
    constructor() {
        this.conversations = new Map();
    }

    getConversation(customerId, platform = 'whatsapp') {
        if (!this.conversations.has(customerId)) {
            this.conversations.set(customerId, {
                customerId,
                platform,
                state: ConversationState.IDLE,
                selectedProduct: null,
                selectedPaymentMethod: null,
                history: [],
                imageContext: [], // Store image analysis results for context
                createdAt: new Date(),
                lastActivity: new Date(),
                failedVerifications: 0,
            });
        }
        return this.conversations.get(customerId);
    }

    addToHistory(conversation, role, content) {
        conversation.history.push({ role, content, timestamp: new Date() });
        conversation.lastActivity = new Date();
        // Keep more history for better context (30 messages)
        if (conversation.history.length > 30) {
            conversation.history = conversation.history.slice(-30);
        }
    }

    addImageContext(conversation, analysis) {
        conversation.imageContext.push({
            type: analysis.type,
            description: analysis.description,
            timestamp: new Date()
        });
        // Keep last 5 image contexts
        if (conversation.imageContext.length > 5) {
            conversation.imageContext = conversation.imageContext.slice(-5);
        }
    }

    async processMessage(customerId, message, platform = 'whatsapp', mediaData = null) {
        const conversation = this.getConversation(customerId, platform);
        logger.info(`[${customerId}] Received: "${message}" (State: ${conversation.state})`);

        // Handle image
        if (mediaData) {
            return await this.handleImage(conversation, mediaData, message);
        }

        this.addToHistory(conversation, 'user', message);
        const response = await this.handleWithAI(conversation, message);
        this.addToHistory(conversation, 'assistant', response.text);

        logger.info(`[${customerId}] Response: "${response.text.substring(0, 50)}..." (State: ${conversation.state})`);
        return response;
    }

    async handleWithAI(conversation, message) {
        const lowerMsg = message.toLowerCase();

        // Try to detect a specific product from message
        const detectedProduct = this.detectProduct(lowerMsg);
        if (detectedProduct) {
            conversation.selectedProduct = detectedProduct;
            logger.info(`[${conversation.customerId}] Product detected: ${detectedProduct.name}`);
        }

        // Check if user selected a payment method
        const paymentMethod = this.detectPaymentMethod(lowerMsg);
        if (paymentMethod && conversation.selectedProduct) {
            conversation.selectedPaymentMethod = paymentMethod;
            conversation.state = ConversationState.AWAITING_PAYMENT;

            const instructions = paymentMethod.instructions.replace('{AMOUNT}', conversation.selectedProduct.priceTND);
            return {
                text: `${instructions}\n\n📸 كي تخلص ابعثلي تصويرة متع الخلصان باش نأكد ونعطيك الحساب 🔐`,
                intent: 'payment_instructions',
            };
        }

        // Simple confirmation when product is already selected
        const simpleConfirms = ['اي', 'باهي', 'ok', 'oui', 'yes', 'تمام', 'نشريه', 'behi', 'ey', 'tmem'];
        const isSimpleConfirm = simpleConfirms.some(kw => lowerMsg.trim() === kw || lowerMsg.includes(kw) && lowerMsg.length < 15);

        if (isSimpleConfirm && conversation.selectedProduct) {
            return {
                text: `باهي! 😊 ${conversation.selectedProduct.name} بـ ${conversation.selectedProduct.priceTND} دينار.\n\nكيفاش تحب تخلص؟\n• D17\n• Flouci\n• Izi Pay`,
                intent: 'ask_payment_method',
            };
        }

        // Let AI handle everything else
        const aiResponse = await aiService.generateResponse(
            message,
            conversation.history.map(h => ({ role: h.role, content: h.content }))
        );

        return aiResponse;
    }

    /**
     * Detect specific product from message
     */
    detectProduct(message) {
        const productMatchers = [
            // CapCut
            { keywords: ['capcut 6', 'capcut 6 mois', '6 شهور capcut', '6 ch\'hour capcut', 'كاب كات 6'], productId: 'capcut-6months' },
            { keywords: ['capcut', 'cap cut', 'كاب كات'], productId: 'capcut-1month' },

            // Gemini / Google AI
            { keywords: ['gemini', 'google ai', 'جوجل'], productId: 'gemini-pro-1year' },

            // ChatGPT
            { keywords: ['chatgpt', 'gpt', 'شات جي بي تي'], productId: 'chatgpt-business-1month' },

            // TOD - check longer durations first
            { keywords: ['tod 12', 'tod سنة', 'tod 1 an', 'tod sne'], productId: 'tod-fullhd-12months' },
            { keywords: ['tod 6', 'tod 6 شهور', 'tod 6 mois'], productId: 'tod-fullhd-6months' },
            { keywords: ['tod 3', 'tod 3 شهور', 'tod 3 mois'], productId: 'tod-fullhd-3months' },
            { keywords: ['tod', 'تود'], productId: 'tod-fullhd-1month' }, // Default to 1 month
        ];

        for (const matcher of productMatchers) {
            if (matcher.keywords.some(kw => message.includes(kw))) {
                return config.products.find(p => p.id === matcher.productId);
            }
        }

        return null;
    }

    detectPaymentMethod(message) {
        const methods = {
            'd17': ['d17', 'd 17'],
            'flouci': ['flouci', 'flousi', 'فلوسي'],
            'izipay': ['izi', 'izipay', 'izi pay', 'إزي'],
        };

        for (const [id, keywords] of Object.entries(methods)) {
            if (keywords.some(kw => message.includes(kw))) {
                return config.paymentMethods.find(pm => pm.id === id);
            }
        }
        return null;
    }

    async handleImage(conversation, mediaData, message) {
        logger.info(`[${conversation.customerId}] 📷 Image received with caption: "${message || '(none)'}"`);

        // First, analyze what type of image this is
        const analysis = await aiService.analyzeImage(
            mediaData.buffer,
            message,
            conversation.history.slice(-5) // Pass more history for context
        );

        // Store image context for future reference
        this.addImageContext(conversation, analysis);

        logger.info(`[${conversation.customerId}] Image type: ${analysis.type} (${analysis.confidence}%)`);

        // Route based on image type
        switch (analysis.type) {
            case 'payment_proof':
                // This is a payment screenshot - verify it
                return await this.handlePaymentImage(conversation, mediaData, message);

            case 'support_issue':
                // Customer is showing a problem
                this.addToHistory(conversation, 'user', `[صورة: ${analysis.description}]`);
                const supportResponse = analysis.suggested_response ||
                    `فهمت المشكلة خويا. أعطيني شوية وقت باش نلقى الحل، واحد من الفريق يتواصل معاك قريب. 🔧`;
                this.addToHistory(conversation, 'assistant', supportResponse);

                // Log for manual follow-up
                logger.info(`🔧 SUPPORT ISSUE from ${conversation.customerId}: ${analysis.description}`);

                return {
                    text: supportResponse,
                    intent: 'support_image',
                };

            case 'question':
                // Customer asking about something
                this.addToHistory(conversation, 'user', `[صورة: ${analysis.description}]`);
                const questionResponse = analysis.suggested_response ||
                    `شفت الصورة! كيفاش نجم نعاونك؟`;
                this.addToHistory(conversation, 'assistant', questionResponse);

                return {
                    text: questionResponse,
                    intent: 'question_image',
                };

            case 'random':
                // Random image - acknowledge politely
                return {
                    text: analysis.suggested_response || `شكرا على الصورة 😊 كيفاش نجم نعاونك؟`,
                    intent: 'random_image',
                };

            default:
                // Unknown - ask for clarification
                return {
                    text: `وصلتني الصورة. هذي تصويرة متع الخلصان ولا عندك سؤال؟`,
                    intent: 'unknown_image',
                };
        }
    }

    /**
     * Handle payment proof images specifically
     */
    async handlePaymentImage(conversation, mediaData, message) {
        // If no product selected, ask which one
        if (!conversation.selectedProduct) {
            return {
                text: `شفت التصويرة! قبل ما نأكد، قولي شنوة المنتوج اللي تحبو:\n\n• CapCut شهر (10د) أو 6 شهور (46د)\n• TOD FullHD (30-180د)\n• ChatGPT Business (19د)\n• Gemini Pro سنة (28د)`,
                intent: 'ask_product_for_payment',
            };
        }

        // Default to D17 if no method selected
        if (!conversation.selectedPaymentMethod) {
            conversation.selectedPaymentMethod = config.paymentMethods[0];
        }

        logger.info(`[${conversation.customerId}] Verifying payment for ${conversation.selectedProduct.name} (${conversation.selectedProduct.priceTND} TND)`);

        try {
            const verification = await aiService.verifyPaymentScreenshot(
                mediaData.buffer,
                conversation.selectedProduct.priceTND,
                conversation.selectedPaymentMethod.id
            );

            // Log detailed OCR results for manual review
            logger.info(`[${conversation.customerId}] OCR Results: Amount=${verification.amount_found}, Phone=${verification.phone_number}, App=${verification.payment_app}, Status=${verification.transaction_status}, Confidence=${verification.confidence}%`);

            if (verification.valid && verification.confidence >= 50 && !verification.suspicious) {
                const amountFound = verification.amount_found || 0;
                const expectedAmount = conversation.selectedProduct.priceTND;

                if (Math.abs(amountFound - expectedAmount) <= 5) {
                    // Check if this product can be auto-delivered (only CapCut 1-month)
                    const isAutoDelivery = conversation.selectedProduct.id === 'capcut-1month';

                    if (isAutoDelivery) {
                        return await this.deliverAccount(conversation, verification);
                    } else {
                        // Manual handling for other products
                        return await this.notifyForManualDelivery(conversation, verification);
                    }
                }
            }

            conversation.failedVerifications++;

            if (conversation.failedVerifications >= 3) {
                return {
                    text: `❌ ما نجمتش نأكد على الخلصان بعد 3 محاولات.\n\nراسلنا على الخاص للمساعدة.\n\nالمنتوج: ${conversation.selectedProduct.name}\nالمبلغ المطلوب: ${conversation.selectedProduct.priceTND} دينار`,
                    intent: 'verification_failed_max',
                };
            }

            const reason = verification.reason || 'الصورة مش واضحة';
            return {
                text: `❌ ما نجمتش نأكد: ${reason}\n\nابعث تصويرة أوضح توري:\n• المبلغ: ${conversation.selectedProduct.priceTND} دينار\n• الحالة: ناجح`,
                intent: 'verification_failed',
            };

        } catch (error) {
            logger.error(`[${conversation.customerId}] Image verification error:`, error);
            return {
                text: `عذرًا، ما نجمتش نقرا الصورة. جرب ابعث تصويرة أخرى أوضح 📸`,
                intent: 'image_error',
            };
        }
    }

    /**
     * Notify for manual delivery (non-auto products)
     */
    async notifyForManualDelivery(conversation, verification) {
        // Log for manual handling
        logger.info(`📦 MANUAL DELIVERY NEEDED:`);
        logger.info(`   Customer: ${conversation.customerId}`);
        logger.info(`   Product: ${conversation.selectedProduct.name}`);
        logger.info(`   Price: ${conversation.selectedProduct.priceTND} TND`);
        logger.info(`   Payment App: ${verification.payment_app}`);
        logger.info(`   Amount Detected: ${verification.amount_found}`);
        logger.info(`   Phone: ${verification.phone_number}`);
        logger.info(`   Confidence: ${verification.confidence}%`);

        // Record pending sale
        await firebaseService.recordSale({
            productName: conversation.selectedProduct.name,
            customerName: conversation.customerId,
            customerPhone: conversation.customerId,
            amountTND: conversation.selectedProduct.priceTND,
            paymentMethod: verification.payment_app || 'Unknown',
            detectedAmount: verification.amount_found,
            detectedPhone: verification.phone_number,
            platform: conversation.platform,
            status: 'pending_manual',
        });

        this.resetConversation(conversation);

        return {
            text: `✅ شكرا! وصلتنا التصويرة متع الخلصان.\n\n` +
                `📋 الطلب:\n` +
                `• المنتوج: ${conversation.selectedProduct.name}\n` +
                `• المبلغ: ${conversation.selectedProduct.priceTND} دينار\n\n` +
                `⏳ راح يتصل بيك واحد من الفريق في أقرب وقت باش يعطيك الحساب.\n\n` +
                `شكرا على ثقتك! 🙏`,
            intent: 'pending_manual_delivery',
        };
    }

    async deliverAccount(conversation) {
        const account = accountService.getAndRemoveAccount(conversation.selectedProduct.id);

        if (!account) {
            logger.error(`[${conversation.customerId}] No accounts available for ${conversation.selectedProduct.id}`);
            return {
                text: `⚠️ عذرًا، خلا الستوك متع ${conversation.selectedProduct.name} مؤقتا.\n\nراح يتصل بيك واحد من الفريق قريبا جدا. شكرًا على صبرك! 🙏`,
                intent: 'out_of_stock',
            };
        }

        await firebaseService.recordSale({
            productName: conversation.selectedProduct.name,
            customerName: conversation.customerId,
            customerPhone: conversation.customerId,
            amountTND: conversation.selectedProduct.priceTND,
            costTND: conversation.selectedProduct.costTND || 0,
            paymentMethod: conversation.selectedPaymentMethod?.name || 'Unknown',
            accountEmail: account.email,
            platform: conversation.platform,
        });

        logger.info(`[${conversation.customerId}] ✅ Account delivered: ${account.email}`);
        this.resetConversation(conversation);

        return {
            text: `✅ تم التأكيد! يعطيك الصحة 🎉\n\n` +
                `🔐 معلومات الحساب:\n\n` +
                `📧 الإيميل: ${account.email}\n` +
                `🔑 الباسوورد: ${account.password}\n\n` +
                `⚠️ ${account.remark || 'استعمل آخر نسخة من التطبيق'}\n\n` +
                `شكرًا وإلى اللقاء! 😊`,
            intent: 'account_delivered',
        };
    }

    resetConversation(conversation) {
        conversation.state = ConversationState.IDLE;
        conversation.selectedProduct = null;
        conversation.selectedPaymentMethod = null;
        conversation.failedVerifications = 0;
    }

    cleanupOldConversations() {
        const maxAge = 24 * 60 * 60 * 1000;
        const now = new Date();

        for (const [customerId, conversation] of this.conversations) {
            if (now - conversation.lastActivity > maxAge) {
                this.conversations.delete(customerId);
                logger.info(`Cleaned up: ${customerId}`);
            }
        }
    }
}

module.exports = new ConversationService();
