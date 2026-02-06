require('dotenv').config();

module.exports = {
  // Google Gemini Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-3-flash-preview',
  },

  // Firebase Configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'abonnement-tn',
    serviceAccountPath: './firebase-serviceAccount.json',
  },

  // Bot Configuration
  bot: {
    name: process.env.BOT_NAME || 'ABONNEMENT.TN',
    language: process.env.BOT_LANGUAGE || 'ar-TN',
    responseDelay: {
      min: parseInt(process.env.MIN_RESPONSE_DELAY) || 2000,
      max: parseInt(process.env.MAX_RESPONSE_DELAY) || 5000,
    },
    workingHours: {
      enabled: false,
      start: 0,
      end: 24,
    },
  },

  // Products Configuration
  products: [
    // CapCut Products
    {
      id: 'capcut-1month',
      name: 'CapCut Teams Pro 1 Mois',
      nameAr: 'كاب كات تيمز برو شهر',
      category: 'capcut',
      duration: '1 mois',
      priceTND: 10,
      accountsFile: 'capcut-1month.txt',
      deliveryMethod: 'ready_account', // Ready-made account (email + password)
      autoDelivery: true,
    },
    {
      id: 'capcut-6months',
      name: 'CapCut Teams Pro 6 Mois',
      nameAr: 'كاب كات تيمز برو 6 شهور',
      category: 'capcut',
      duration: '6 mois',
      priceTND: 46,
      accountsFile: 'capcut-6months.txt',
      deliveryMethod: 'ready_account',
      autoDelivery: false, // Manual delivery
    },

    // Google AI / Gemini Pro
    {
      id: 'gemini-pro-1year',
      name: 'Google AI Pro / Gemini Pro 1 An',
      nameAr: 'جوجل AI برو سنة',
      category: 'ai',
      duration: '1 an',
      priceTND: 28,
      deliveryMethod: 'family_invite', // Invite buyer email to family membership
      requiresBuyerEmail: true,
      autoDelivery: false,
    },

    // ChatGPT Business
    {
      id: 'chatgpt-business-1month',
      name: 'ChatGPT Business 1 Mois',
      nameAr: 'شات جي بي تي بيزنس شهر',
      category: 'ai',
      duration: '1 mois',
      priceTND: 19,
      deliveryMethod: 'workspace_add', // Add buyer email to workspace
      requiresBuyerEmail: true,
      autoDelivery: false,
    },

    // TOD FullHD Products (Top up - buyer provides email + password)
    {
      id: 'tod-fullhd-1month',
      name: 'TOD FullHD 1 Mois',
      nameAr: 'TOD فل اتش دي شهر',
      category: 'streaming',
      duration: '1 mois',
      priceTND: 30,
      deliveryMethod: 'top_up',
      requiresBuyerCredentials: true, // Needs buyer email + password
      autoDelivery: false,
    },
    {
      id: 'tod-fullhd-3months',
      name: 'TOD FullHD 3 Mois',
      nameAr: 'TOD فل اتش دي 3 شهور',
      category: 'streaming',
      duration: '3 mois',
      priceTND: 62,
      deliveryMethod: 'top_up',
      requiresBuyerCredentials: true,
      autoDelivery: false,
    },
    {
      id: 'tod-fullhd-6months',
      name: 'TOD FullHD 6 Mois',
      nameAr: 'TOD فل اتش دي 6 شهور',
      category: 'streaming',
      duration: '6 mois',
      priceTND: 110,
      deliveryMethod: 'top_up',
      requiresBuyerCredentials: true,
      autoDelivery: false,
    },
    {
      id: 'tod-fullhd-12months',
      name: 'TOD FullHD 12 Mois',
      nameAr: 'TOD فل اتش دي سنة',
      category: 'streaming',
      duration: '12 mois',
      priceTND: 180,
      deliveryMethod: 'top_up',
      requiresBuyerCredentials: true,
      autoDelivery: false,
    },
  ],

  // Payment Methods
  paymentMethods: [
    {
      id: 'd17',
      name: 'D17',
      instructions: 'ابعث {AMOUNT} دينار عبر D17 للرقم: 27389293',
    },
    {
      id: 'flouci',
      name: 'Flouci',
      instructions: 'ابعث {AMOUNT} دينار عبر Flouci للرقم: 93868566',
    },
    {
      id: 'izipay',
      name: 'Izi Pay',
      instructions: 'ابعث {AMOUNT} دينار عبر Izi Pay للرقم: 27389293',
    },
  ],

  // Paths
  paths: {
    accounts: './data/accounts',
    delivered: './data/delivered',
    sessions: './data/sessions',
  },
};
