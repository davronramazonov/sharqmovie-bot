const axios = require('axios');

const API_KEY = process.env.GEMINI_API_KEY;

module.exports = async (question) => {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY yo‘q');
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

  const response = await axios.post(url, {
    contents: [
      {
        parts: [{ text: question }]
      }
    ]
  });

  const text =
    response.data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini javob qaytarmadi');
  }

  return text;
};
