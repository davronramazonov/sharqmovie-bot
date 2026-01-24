const axios = require('axios');

module.exports = async function askGemini(question) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return `🤖 Savolingiz qabul qilindi:

"${question}"

Tez orada javob beramiz.`;
    }

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: question }]
          }
        ]
      }
    );

    return (
      res.data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Savolingizga hozircha javob topilmadi.'
    );
  } catch (e) {
    return 'Savol qabul qilindi, keyinroq javob beramiz.';
  }
};
