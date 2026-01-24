const { cancelMenu, mainMenu } = require('../keyboards');
const { trackUser, trackOrder } = require('./stats');
const state = require('../state');

const adminIds = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(',').map(id => id.trim())
  : [];

module.exports = (bot) => {

  bot.hears('📥 Buyurtma berish', (ctx) => {
    state.orders[ctx.from.id] = { step: 1 };
    ctx.reply('✍️ Ismingizni yozing:', cancelMenu);
  });

  bot.hears('❌ Bekor qilish', (ctx) => {
    delete state.orders[ctx.from.id];
    ctx.reply('❌ Buyurtma bekor qilindi.', mainMenu);
  });
};
