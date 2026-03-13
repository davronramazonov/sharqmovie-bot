const axios = require('axios');
const { GEMINI_API_KEY } = require('../../config/env');

module.exports = async function askGemini(question) {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: question }]
          }
        ]
      },
      { timeout: 15000 }
    );

    return (
      res.data.candidates?.[0]?.content?.parts?.[0]?.text
      || null
    );
  } catch (e) {
    console.error('❌ Gemini error:', e.response?.data || e.message);
    return null;
  }
};
