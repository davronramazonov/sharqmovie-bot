const faq = require('./faqData');

function findFaqAnswer(question) {
  const q = question.toLowerCase();

  for (const item of faq) {
    if (item.keywords.some(k => q.includes(k))) {
      return item.answer;
    }
  }
  return null;
}

module.exports = findFaqAnswer;
