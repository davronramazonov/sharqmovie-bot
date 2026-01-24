const state = require('../state');

module.exports = (bot) => {

  bot.hears('🤝 Homiylik', (ctx) => {
    state.sponsorMode = state.sponsorMode || {};
    state.sponsorMode[ctx.from.id] = true;

    ctx.reply(
`🤝 Homiylik

Agar SharqTech loyihalarini qo‘llab-quvvatlamoqchi bo‘lsangiz,
iltimos xabaringizni yozing.

Biz siz bilan albatta bog‘lanamiz.`
    );
  });
};
