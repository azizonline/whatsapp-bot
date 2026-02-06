// Test Gemini 3 Flash variations
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const models = [
    'gemini-3-flash',
    'gemini-flash-3',
    'gemini3-flash',
    'gemini-flash-2.5',
    'flash-3',
    'gemini-3-flash-preview',
    'gemini-3-flash-latest'
];

async function testModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('Looking for Gemini 3 Flash...\n');

    const client = new GoogleGenerativeAI(apiKey);

    for (const modelName of models) {
        try {
            console.log(`Testing: ${modelName}...`);
            const model = client.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Say hi');
            console.log(`✅ ${modelName} WORKS!`);
            return;
        } catch (error) {
            console.log(`❌ ${modelName} - not found`);
        }
    }

    console.log('\nGemini 3 Flash not found yet. Using gemini-2.5-flash (latest available)');
}

testModels();
