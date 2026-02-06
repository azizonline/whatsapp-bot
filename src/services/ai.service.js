const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');
const logger = require('../utils/logger');

class AIService {
    constructor() {
        this.client = null;
        this.model = null;
        this.visionModel = null;
        this.initialized = false;
    }

    initialize() {
        const apiKey = config.gemini?.apiKey || process.env.GEMINI_API_KEY;

        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            logger.error('Gemini API key not configured');
            return false;
        }

        try {
            this.client = new GoogleGenerativeAI(apiKey);
            this.model = this.client.getGenerativeModel({ model: 'gemini-3-flash-preview' });
            this.visionModel = this.client.getGenerativeModel({ model: 'gemini-3-flash-preview' });

            this.initialized = true;
            logger.info('Gemini AI initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Gemini:', error.message);
            return false;
        }
    }

    getSystemPrompt() {
        // Get current hour for time-based greeting
        const hour = new Date().getHours();
        let timeGreeting = 'مرحبا';
        if (hour >= 5 && hour < 12) timeGreeting = 'صباح الخير';
        else if (hour >= 12 && hour < 18) timeGreeting = 'مساء الخير';
        else timeGreeting = 'مساء النور';

        return `أنت مساعد مبيعات تونسي لـ ABONNEMENT.TN - أنت جزء من الفريق، مش موظف خارجي.

🎯 هويتك:
- تكلم كأنك صاحب البزنس أو جزء أساسي من الفريق
- استعمل "أنايا" أو "نحنا" (مش "الإدارة" أو "المسؤول")
- ما تقولش "راجع الإدارة" أو "المدير" - أنت هو اللي يحل
- أنت المسؤول على المبيعات والدعم

📋 المنتوجات وطريقة التسليم:

🎬 CapCut Teams Pro:
- شهر: 10 دينار | 6 شهور: 46 دينار
- التسليم: حساب جاهز (إيميل + باسوورد) - seat في teams

🤖 ChatGPT Business:
- شهر: 19 دينار
- التسليم: نضيفك للـ workspace - أعطيني إيميلك

🤖 Google AI Pro / Gemini Pro:
- سنة: 28 دينار
- التسليم: invitation للـ family membership - أعطيني إيميلك

📺 TOD FullHD:
- شهر: 30د | 3 شهور: 62د | 6 شهور: 110د | سنة: 180د
- التسليم: top up - أعطيني الإيميل والباسوورد متع حسابك TOD

💳 طرق الدفع: D17 (27389293) | Flouci (93868566) | Izi Pay (27389293)

🌟 التحيات (مهم جداً):
- إبدأ بتحية إيجابية فقط
- ما تذكرش "مشاكل" أو "عندك مشكلة؟" في التحية - red flag
- أمثلة تحيات صحيحة:
  * "${timeGreeting}! كيفاش نعاونك اليوم؟"
  * "أهلا وسهلا! شنحب نخدملك؟"
  * "مرحبا بيك! 😊"
  * "عسلامة! تفضل"

🚫 ما تقولش أبداً:
- "راجع الإدارة" أو "المدير"
- "عندك مشكلة؟" في التحية
- "مشكلة تقنية"
- "جرب مرة أخرى"

✅ قول:
- "توا نحلهالك" (مش "راح نحلولك")
- "نثبتلك فيها" (مش "الفريق يتابع")
- "أنا هنا نعاونك"

🔧 Support (لما يجي بمشكلة):
1. اسأل أسئلة محددة: "شنوة الإيميل؟" "شنوة الرسالة؟"
2. طمّنو: "ما تقلقش، توا نحلها"
3. اجمع المعلومات وحل أو قول: "توا نثبت ونرجعلك"

💬 الأسلوب:
- تونسي طبيعي مريح
- ودود وقريب
- واثق (أنت اللي تحل)
- متنوع (ما تكررش نفس الردود)
- استعمل إيموجي بشكل طبيعي 😊

🎲 تنويع الردود:
بدل ما تقول نفس الشي، نوّع:
- "باهي!" / "تمام!" / "مريڨل!" / "حاضر!"
- "كيفاش تحب تخلص؟" / "شنوة طريقة الخلاص؟"
- "ابعثلي" / "أعطيني" / "وريني"`;
    }

    async generateResponse(message, conversationHistory = []) {
        if (!this.initialized) {
            logger.error('AI not initialized');
            return { text: 'عذرًا، فما مشكلة تقنية. جرب مرة أخرى.', intent: 'error' };
        }

        try {
            // Pass more history for better context (12 messages)
            const historyText = conversationHistory.slice(-12).map(h =>
                `${h.role === 'user' ? 'العميل' : 'البوت'}: ${h.content}`
            ).join('\n');

            const prompt = `${this.getSystemPrompt()}

المحادثة السابقة:
${historyText}

العميل قال: "${message}"

جاوب بالتونسي (قصير - 2-3 جمل):`;

            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text().trim();

            const cleanedResponse = this.cleanResponse(responseText);
            const intent = this.detectIntent(message, cleanedResponse);

            logger.info(`AI Response generated. Intent: ${intent}`);

            return { text: cleanedResponse, intent };
        } catch (error) {
            logger.error('AI generation error:', error.message);
            return { text: 'عذرًا، فما مشكلة. جرب مرة أخرى بعد شوية.', intent: 'error' };
        }
    }

    cleanResponse(text) {
        return text
            .replace(/^(البوت:|Bot:|Assistant:|بوت:)\s*/i, '')
            .replace(/^\*\*.*?\*\*\s*/g, '')
            .trim();
    }

    detectIntent(message, response) {
        const lowerMessage = message.toLowerCase();

        const productKeywords = ['capcut', 'tod', 'chatgpt', 'gemini', 'google ai', 'كاب كات'];
        const buyKeywords = ['نحب', 'نشري', 'باهي', 'نعم', 'ok', 'oui', 'yes', 'تمام', 'nheb', 'nchri'];
        const paymentKeywords = ['d17', 'flouci', 'izipay', 'izi pay', 'izi'];
        const priceKeywords = ['قداش', 'بشحال', 'السعر', 'سوم', 'prix', 'combien'];
        const supportKeywords = ['مشكلة', 'ما يخدمش', 'problem', 'help', 'مساعدة'];

        if (paymentKeywords.some(kw => lowerMessage.includes(kw))) return 'payment_method';
        if (supportKeywords.some(kw => lowerMessage.includes(kw))) return 'support';
        if (productKeywords.some(kw => lowerMessage.includes(kw)) && buyKeywords.some(kw => lowerMessage.includes(kw))) return 'purchase';
        if (priceKeywords.some(kw => lowerMessage.includes(kw))) return 'inquiry';

        return 'general';
    }

    /**
     * Analyze image to determine its purpose
     */
    async analyzeImage(imageData, messageCaption, conversationContext) {
        if (!this.initialized) {
            return { type: 'unknown', response: null };
        }

        try {
            let base64Image;
            if (Buffer.isBuffer(imageData)) {
                base64Image = imageData.toString('base64');
            } else if (typeof imageData === 'string' && imageData.startsWith('data:')) {
                base64Image = imageData.split(',')[1];
            } else {
                base64Image = imageData;
            }

            const prompt = `أنت مساعد ذكي تونسي. حلل هذه الصورة وافهم قصد المرسل.

📝 الرسالة المرفقة: "${messageCaption || '(بدون نص)'}"

🔍 حدد نوع الصورة:

1. "payment_proof" - إثبات دفع من تطبيق (D17, Flouci, IziPay):
   - صورة شاشة من تطبيق دفع
   - تظهر مبلغ وحالة معاملة
   - ألوان خضراء (D17) أو برتقالية (Flouci) أو زرقاء (Izi)

2. "support_issue" - مشكلة أو شكوى:
   - صورة خطأ أو error
   - صورة تطبيق لا يعمل
   - صورة حساب لا يدخل
   - صورة توضح مشكلة ما

3. "question" - سؤال أو استفسار:
   - صورة منتوج يسأل عنه
   - صورة لتوضيح ما يريد
   - صورة مقارنة أو معلومات

4. "random" - صورة عشوائية:
   - Meme أو صورة مضحكة
   - صورة شخصية
   - صورة لا علاقة لها بالتجارة

أجب بـ JSON:
{
  "type": "payment_proof" أو "support_issue" أو "question" أو "random",
  "description": "وصف مختصر لمحتوى الصورة",
  "suggested_response": "رد مناسب بالتونسي إذا كانت الصورة support أو question أو random",
  "confidence": 0-100
}`;

            const imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType: 'image/jpeg',
                },
            };

            const result = await this.visionModel.generateContent([prompt, imagePart]);
            const responseText = result.response.text();

            logger.info(`Image analysis: ${responseText.substring(0, 150)}...`);

            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return { type: 'unknown', description: 'ما نجمتش نفهم الصورة', confidence: 0 };
        } catch (error) {
            logger.error('Image analysis error:', error.message);
            return { type: 'unknown', description: 'فشل تحليل الصورة', confidence: 0 };
        }
    }

    async verifyPaymentScreenshot(imageData, expectedAmount, paymentMethod) {
        if (!this.initialized) {
            return { valid: false, reason: 'Service unavailable', confidence: 0 };
        }

        try {
            let base64Image;
            if (Buffer.isBuffer(imageData)) {
                base64Image = imageData.toString('base64');
            } else if (typeof imageData === 'string' && imageData.startsWith('data:')) {
                base64Image = imageData.split(',')[1];
            } else {
                base64Image = imageData;
            }

            const prompt = `أنت محلل صور OCR متخصص في تطبيقات الدفع التونسية. حلل هذه الصورة بدقة.

🎯 مهمتك الأساسية:
1. استخرج المبلغ المدفوع (الرقم بالضبط)
2. حدد تطبيق الدفع المستخدم
3. استخرج اسم المستلم أو رقم الهاتف
4. تأكد من نجاح المعاملة

📱 كيف تتعرف على التطبيق:
- D17: واجهة خضراء، شعار D17، "La Poste Tunisienne"
- Flouci: واجهة برتقالية/صفراء، شعار Flouci
- IziPay/Izi: واجهة زرقاء، شعار Izi

✅ معلومات المستلم للتأكيد:
- D17: رقم 27389293
- Flouci: ابحث عن اسم المستلم - يجب أن يحتوي على "Mohamed" و "Aziz" و "Hidouri" (بأي ترتيب أو كتابة). أمثلة صحيحة:
  * "Mohamed Aziz Hidouri"
  * "MOHAMED AZIZ HIDOURI" 
  * "mohamed aziz hidouri"
  * "Med Aziz Hidouri"
  * "M. Aziz Hidouri"
- IziPay: رقم 27389293

💰 المبلغ المتوقع: ${expectedAmount} دينار (±3 دينار مقبول)

✅ علامات النجاح:
- "تمت العملية بنجاح" / "Successful" / "ناجح"
- علامة ✓ خضراء
- "Transaction réussie"

🔍 استخرج بدقة:
1. المبلغ الظاهر في الصورة (رقم فقط)
2. رقم الهاتف المستلم (لـ D17/Izi) أو اسم المستلم (لـ Flouci)
3. اسم التطبيق من الواجهة
4. حالة المعاملة
5. التاريخ إن وجد

أجب بـ JSON فقط:
{
  "valid": true/false,
  "amount_found": الرقم المستخرج أو null,
  "phone_number": "رقم الهاتف" أو null,
  "receiver_name": "اسم المستلم من Flouci" أو null,
  "payment_app": "D17" أو "Flouci" أو "IziPay" أو "unknown",
  "app_detected_by": "سبب التعرف على التطبيق",
  "transaction_status": "success" أو "pending" أو "failed",
  "transaction_date": "التاريخ إن وجد" أو null,
  "confidence": 0-100,
  "reason": "سبب القرار",
  "suspicious": true/false
}`;

            const imagePart = {
                inlineData: {
                    data: base64Image,
                    mimeType: 'image/jpeg',
                },
            };

            const result = await this.visionModel.generateContent([prompt, imagePart]);
            const responseText = result.response.text();

            logger.info(`Vision response: ${responseText.substring(0, 200)}`);

            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);

                // Extra security check
                if (parsed.suspicious) {
                    parsed.valid = false;
                    parsed.reason = 'صورة مشبوهة';
                }

                logger.info(`Payment verification: valid=${parsed.valid}, confidence=${parsed.confidence}%`);
                return parsed;
            }

            return { valid: false, reason: 'ما نجمتش نحلل الصورة', confidence: 0 };
        } catch (error) {
            logger.error('Payment verification error:', error.message);
            return { valid: false, reason: 'فشل التحقق', confidence: 0 };
        }
    }
}

module.exports = new AIService();
