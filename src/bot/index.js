const { Telegraf } = require('telegraf');
require('dotenv').config();

const { mainMenu, adminMenu } = require('./keyboards');
const state = require('./state');
const askGemini = require('./services/gemini');
const findFaqAnswer = require('./services/faqMatcher');
const { trackUser, trackOrder, getStats } = require('./handlers/stats');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== ADMIN ID LAR =====
const adminIds = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(',').map(id => id.trim())
  : [];

// ===== START =====
bot.start((ctx) => {
  trackUser(ctx.from.id);
  ctx.reply('👋 SharqTech botiga xush kelibsiz', mainMenu);
});

// ================= ADMIN MENYU =================

// EʼLON
bot.hears('📢 Eʼlon berish', (ctx) => {
  if (!adminIds.includes(String(ctx.from.id))) return;
  state.admin.announceMode = true;
  ctx.reply('📢 Eʼlon matnini yuboring:', adminMenu);
});

// STATISTIKA
bot.hears('📊 Statistika', (ctx) => {
  if (!adminIds.includes(String(ctx.from.id))) return;

  const s = getStats();
  ctx.reply(
`📊 STATISTIKA

👥 Foydalanuvchilar: ${s.users}
📥 Jami buyurtmalar: ${s.totalOrders}
📆 Bugungi buyurtmalar: ${s.todayOrders}`,
    adminMenu
  );
});

// ================= USER MENYU =================

// SAVOL
bot.hears('❓ Savol berish', (ctx) => {
  state.userMode[ctx.from.id] = 'question';
  ctx.reply('❓ Savolingizni yozing.\nTugatgach ⬅️ Orqaga ni bosing.');
});

// HOMIYLIK
bot.hears('🤝 Homiylik', (ctx) => {
  state.userMode[ctx.from.id] = 'sponsor';
  ctx.reply(
`🤝 Homiylik uchun bog‘lanish:

Telegram: @SharqTech
Telefon: +998907996066
Email: sharqtechuz@gmail.com

Agar xabar qoldirmoqchi bo‘lsangiz, yozing.`
  );
});

// ALOQA
bot.hears('📞 Aloqa', (ctx) => {
  ctx.reply(
`📞 Aloqa maʼlumotlari:

Telegram: @SharqTech
Telefon: +998907996066
Email: sharqtechuz@gmail.com

🌐 https://sharqtech.carrd.co/#`
  );
});

// BIZ HAQIMIZDA
bot.hears('ℹ️ Biz haqimizda', (ctx) => {
  ctx.reply(
`SharqTech — IT va sunʼiy intellekt yechimlari jamoasi.

🛠 Ijtimoiy muammolarga IT-yechimlar
🎓 Yoshlar uchun sodda IT-darslar
📅 2025-yil 25-noyabrda asos solingan

Tez orada rasmiy web-sayt ishga tushadi 🚀`
  );
});

// ORQAGA
bot.hears('⬅️ Orqaga', (ctx) => {
  delete state.userMode[ctx.from.id];
  ctx.reply('Asosiy menyu', mainMenu);
});

// ================= MARKAZIY TEXT HANDLER =================
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  // ===== ADMIN EʼLON YUBORISH =====
  if (adminIds.includes(String(userId)) && state.admin.announceMode) {
    state.admin.announceMode = false;

    const users = getStats().usersList;
    for (const uid of users) {
      try {
        await bot.telegram.sendMessage(uid, text);
      } catch {}
    }

    return ctx.reply('✅ Eʼlon barcha foydalanuvchilarga yuborildi', adminMenu);
  }

  // ===== SAVOL-JAVOB =====
  if (state.userMode[userId] === 'question') {
    const faqAnswer = findFaqAnswer(text);
    if (faqAnswer) {
      return ctx.reply(faqAnswer);
    }

    const aiAnswer = await askGemini(text);
    return ctx.reply(aiAnswer);
  }

  // ===== HOMIYLIK XABARI =====
  if (state.userMode[userId] === 'sponsor') {
    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(
          adminId,
`🤝 HOMIYLIK XABARI

🆔 ${userId}
✉️ ${text}`
        );
      } catch {}
    }

    return ctx.reply('🙏 Rahmat! Xabaringiz adminga yuborildi.');
  }
});

// ===== BOTNI ISHGA TUSHIRISH =====
bot.launch();
console.log('🤖 SharqTech bot ishga tushdi');
