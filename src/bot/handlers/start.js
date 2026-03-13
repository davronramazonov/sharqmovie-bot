const { mainMenu } = require('../keyboards');
const { trackUser } = require('./stats');

module.exports = function startHandler(bot) {
  bot.start((ctx) => {
    trackUser(ctx.from.id);
    ctx.reply('👋 SharqTech botiga xush kelibsiz!', mainMenu);
  });
};
