const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== IMPORTLAR =====
const { mainMenu, adminMenu, backMenu } = require('./keyboards');

const orderHandler = require('./handlers/order');
const adminHandler = require('./handlers/admin');
const contactHandler = require('./handlers/contact');
const aboutHandler = require('./handlers/about');
const sponsorHandler = require('./handlers/sponsor');

const state = require('./state');

const findFaqAnswer = require('./services/faqMatcher');
const askGemini = require('./services/gemini');

const { trackUser, trackOrder, getStats } = require('./handlers/stats');

// ===== ADMIN ID =====
const adminIds = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(',').map(id => id.trim())
  : [];

// ===== START =====
bot.start((ctx) => {
  trackUser(ctx.from.id);
  ctx.reply('👋 SharqTech botiga xush kelibsiz', mainMenu);
});

// ===== MENYU HANDLERLARI =====

// SAVOLLAR BOSHLASH
bot.hears('❓ Savollar', (ctx) => {
  state.faqMode[ctx.from.id] = true;

  ctx.reply(
`❓ Savolingizni yozing.
Istalgan mavzuda bo‘lishi mumkin.

⬅️ Ortga — asosiy menyuga qaytish`,
    backMenu
  );
});

// ===== HANDLERLARNI ULASH =====
orderHandler(bot);
adminHandler(bot);
contactHandler(bot);
aboutHandler(bot);
sponsorHandler(bot);

// ===== MARKAZIY TEXT HANDLER =====
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const isAdmin = adminIds.includes(String(userId));

  // =====================
  // SAVOLLAR (FAQ + GEMINI)
  // =====================
  if (state.faqMode[userId]) {

    // ORTGA
    if (text === '⬅️ Ortga') {
      state.faqMode[userId] = false;
      return ctx.reply('🏠 Asosiy menyu', mainMenu);
    }

    // FAQ bo‘lsa
    const faqAnswer = findFaqAnswer(text);
    if (faqAnswer) {
      return ctx.reply(faqAnswer);
    }

    // FAQ bo‘lmasa → GEMINI
    try {
      const aiAnswer = await askGemini(text);
      return ctx.reply(aiAnswer);
    } catch {
      return ctx.reply(
        '❌ Hozircha javob berib bo‘lmadi. Boshqa savol berib ko‘ring.'
      );
    }
  }

  // =====================
  // HOMIYLIK
  // =====================
  if (state.sponsorMode && state.sponsorMode[userId]) {
    state.sponsorMode[userId] = false;

    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(
          adminId,
`🤝 YANGI HOMIYLIK SO‘ROVI

👤 ${ctx.from.first_name || ''}
🆔 ${userId}
📝 Xabar:
${text}`
        );
      } catch {}
    }

    return ctx.reply(
`🙏 Rahmat!
Homiylik bo‘yicha xabaringiz qabul qilindi.
Tez orada siz bilan bog‘lanamiz.`,
      mainMenu
    );
  }

  // =====================
  // ADMIN: EʼLON BERISH
  // =====================
  if (isAdmin && state.admin.announceMode) {
    state.admin.announceMode = false;

    const users = getStats().usersList;

    for (const uid of users) {
      try {
        await bot.telegram.sendMessage(uid, text);
      } catch {}
    }

    return ctx.reply('✅ Eʼlon barcha foydalanuvchilarga yuborildi', adminMenu);
  }

  // =====================
  // BUYURTMA JARAYONI
  // =====================
  const order = state.orders[userId];
  if (!order) return;

  if (order.step === 1) {
    order.name = text;
    order.step = 2;
    return ctx.reply('📞 Telefon raqamingizni yozing:');
  }

  if (order.step === 2) {
    order.phone = text;
    order.step = 3;
    return ctx.reply('📝 Buyurtma tafsilotlarini yozing:');
  }

  if (order.step === 3) {
    order.description = text;

    trackUser(userId);
    trackOrder();

    await ctx.reply(
`✅ Buyurtma qabul qilindi!

👤 ${order.name}
📞 ${order.phone}
📝 ${order.description}

Tez orada siz bilan bog‘lanamiz.`,
      mainMenu
    );

    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(
          adminId,
`📥 YANGI BUYURTMA

👤 ${order.name}
📞 ${order.phone}
📝 ${order.description}
🆔 ${userId}`
        );
      } catch {}
    }

    delete state.orders[userId];
  }
});

// ===== BOTNI ISHGA TUSHIRISH =====
bot.launch();
console.log('🤖 SharqTech bot ishga tushdi');
