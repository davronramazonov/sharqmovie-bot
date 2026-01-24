const state = require('../state');
const { backMenu } = require('../keyboards');

module.exports = (bot) => {
  bot.hears('❓ Savollar', (ctx) => {
    state.faqMode[ctx.from.id] = true;

    ctx.reply(
`❓ Savolingizni yozing.
Istalgan mavzuda bo‘lishi mumkin.

⬅️ Ortga — asosiy menyuga qaytish`,
      backMenu
    );
  });
};
