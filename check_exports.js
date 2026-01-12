
const ai = require('ai');
console.log('AI Exports:', Object.keys(ai));
try {
    const google = require('@ai-sdk/google');
    console.log('Google SDK Exports:', Object.keys(google));
} catch (e) { }
