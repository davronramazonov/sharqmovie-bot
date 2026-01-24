const { adminMenu, mainMenu } = require('../keyboards');
const { getStats } = require('./stats');
const state = require('../state');

const adminIds = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(',').map(id => id.trim())
  : [];

module.exports = (bot) => {

  // ===== ADMIN PANEL (FAQAT ADMIN) =====
  bot.command('admin', (ctx) => {
    const userId = String(ctx.from.id);

    if (!adminIds.includes(userId)) {
      return ctx.reply('⛔ Siz admin emassiz.');
    }

    ctx.reply('🔐 Admin panel', adminMenu);
  });

  // ===== STATISTIKA (FAQAT ADMIN) =====
  bot.hears('📊 Statistika', (ctx) => {
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) return;

    const stats = getStats();

    ctx.reply(
`📊 STATISTIKA

👥 Foydalanuvchilar soni: ${stats.users}

📦 Jami buyurtmalar: ${stats.totalOrders}
📅 Bugungi buyurtmalar: ${stats.todayOrders}
`,
      adminMenu
    );
  });

  // ===== EʼLON BERISH (FAQAT ADMIN) =====
  bot.hears('📢 Eʼlon berish', (ctx) => {
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) return;

    state.admin.announceMode = true;
    ctx.reply(
`✍️ Eʼlon matnini yozing.
Nima yozsangiz, o‘sha holatda foydalanuvchilarga yuboriladi.`
    );
  });

  // ===== ADMIN ORTGA =====
  bot.hears('⬅️ Ortga', (ctx) => {
    const userId = String(ctx.from.id);
    if (!adminIds.includes(userId)) return;

    ctx.reply('🏠 Asosiy menyu', mainMenu);
  });
};
