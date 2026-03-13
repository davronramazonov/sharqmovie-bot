const { Markup } = require('telegraf');
const { adminMenu } = require('../keyboards');
const state = require('../state');
const db = require('../../db/sqlite');
const env = require('../../config/env');

const ADMIN_ID = env.ADMIN_ID;

console.log('Admin ID from env:', ADMIN_ID);

module.exports = function adminHandlers(bot) {
  console.log('Admin handlers loaded, ADMIN_ID:', ADMIN_ID);
  
  bot.command('admin', async (ctx) => {
    try {
      const userId = String(ctx.from.id);
      console.log('User ID:', userId, 'Admin ID:', ADMIN_ID, 'Match:', userId === ADMIN_ID);
      
      if (userId !== ADMIN_ID) {
        return ctx.reply('⛔ Siz admin emassiz. Sizning ID: ' + userId);
      }
      
      return ctx.reply('🔐 Admin panel', adminMenu);
    } catch (e) {
      console.error('Admin command error:', e);
      ctx.reply('❌ Xatolik: ' + e.message);
    }
  });

  bot.command('addmovie', (ctx) => {
    const userId = String(ctx.from.id);
    if (userId !== ADMIN_ID) {
      return ctx.reply('⛔ Siz admin emassiz. Sizning ID: ' + userId);
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 3) {
      return ctx.reply('❌ Format: /addmovie movie_code movie_name post_link\n\nMisol: /addmovie 1023 Avatar https://t.me/c/1945678123/25');
    }

    const code = args[0];
    const name = args.slice(1, -1).join(' ');
    const link = args[args.length - 1];

    state.addMovie[ctx.from.id] = { code, name };
    ctx.reply(`📎 Endi post linkini yuboring:\n${link}`, adminMenu);
  });

  bot.command('addseries', (ctx) => {
    if (String(ctx.from.id) !== ADMIN_ID) {
      return ctx.reply('⛔ Siz admin emassiz.');
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 4) {
      return ctx.reply('❌ Format: /addseries series_name season episode post_link\n\nMisol: /addseries BreakingBad 1 1 https://t.me/c/1945678123/30');
    }

    const name = args.slice(0, -3).join(' ');
    const season = parseInt(args[args.length - 3]);
    const episode = parseInt(args[args.length - 2]);
    const link = args[args.length - 1];

    if (isNaN(season) || isNaN(episode)) {
      return ctx.reply('❌ Season va episode raqam bo\'lishi kerak.');
    }

    state.addSeries[ctx.from.id] = { name, season, episode };
    ctx.reply(`📎 Endi post linkini yuboring:\n${link}`, adminMenu);
  });

  bot.command('delmovie', (ctx) => {
    if (String(ctx.from.id) !== ADMIN_ID) {
      return ctx.reply('⛔ Siz admin emassiz.');
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 1) {
      return ctx.reply('❌ Format: /delmovie movie_code');
    }

    const movie = db.getMovieByCode(args[0]);
    if (!movie) {
      return ctx.reply('❌ Kino topilmadi.');
    }

    db.deleteMovie(movie.id);
    ctx.reply(`✅ Kino o'chirildi: ${movie.movie_name}`);
  });

  bot.command('addchannel', (ctx) => {
    if (String(ctx.from.id) !== ADMIN_ID) {
      return ctx.reply('⛔ Siz admin emassiz.');
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
      return ctx.reply('❌ Format: /addchannel channel_id channel_link\n\nMisol: /addchannel -1001945678123 https://t.me/yourchannel\n\nMajburiy qilish uchun: /addchannel -1001945678123 https://t.me/yourchannel required');
    }

    const isRequired = args[2] === 'required';
    state.addChannel[ctx.from.id] = { isRequired };
    ctx.reply('✅ Kanal ma\'lumotlari qabul qilindi.', adminMenu);

    db.addChannel(args[0], args[1], isRequired ? 1 : 0);
    ctx.reply(`✅ Kanal qo'shildi!\n\nID: ${args[0]}\nLink: ${args[1]}\nMajburiy: ${isRequired ? 'Ha' : "Yo'q"}`);
  });

  bot.command('addad', (ctx) => {
    if (String(ctx.from.id) !== ADMIN_ID) {
      return ctx.reply('⛔ Siz admin emassiz.');
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 1) {
      return ctx.reply('❌ Format: /addad ad_text [ad_link]\n\nMisol: /addad Kanalimiz https://t.me/yourchannel');
    }

    let adLink = null;
    let adText = args.join(' ');
    
    if (adText.includes('http')) {
      const parts = adText.match(/(.+)\s+(https?:\/\/.+)/);
      if (parts) {
        adText = parts[1];
        adLink = parts[2];
      }
    }

    state.addAd[ctx.from.id] = { text: adText };
    ctx.reply('✅ Reklama q\'oshildi!', adminMenu);

    db.addAd(adText, adLink);
    ctx.reply(`✅ Reklama qo'shildi!\n\n📣 ${adText}${adLink ? '\n🔗 ' + adLink : ''}`);
  });

  bot.command('stats', (ctx) => {
    if (String(ctx.from.id) !== ADMIN_ID) {
      return ctx.reply('⛔ Siz admin emassiz.');
    }

    const userCount = db.getUserCount();
    ctx.reply(`📊 Statistika\n\n👥 Foydalanuvchilar: ${userCount}`);
  });

  bot.hears('📊 Statistika', (ctx) => {
    if (String(ctx.from.id) !== ADMIN_ID) return;
    const userCount = db.getUserCount();
    ctx.reply(`📊 Statistika\n\n👥 Foydalanuvchilar: ${userCount}`, adminMenu);
  });

  bot.hears('⬅️ Asosiy menyu', (ctx) => {
    if (String(ctx.from.id) !== ADMIN_ID) return;
    ctx.reply('🏠 Asosiy menyu', mainMenu);
  });
};
