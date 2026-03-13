const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = '1041434250';

const mainMenu = Markup.keyboard([
  ['🎬 Kino qidirish'],
  ['📺 Seriallar'],
  ['📞 Aloqa']
]).resize();

const adminMenu = Markup.keyboard([
  ['📊 Statistika'],
  ['➕ Kino qo\'shish'],
  ['➕ Serial qo\'shish'],
  ['🗑️ Kino o\'chirish'],
  ['📢 Kanal qo\'shish'],
  ['📣 Reklama qo\'shish'],
  ['⬅️ Asosiy menyu']
]).resize();

const db = require('../db/sqlite');

function parseChannelLink(link) {
  const match = link.match(/t\.me\/c\/(\d+)\/(\d+)/);
  if (match) {
    return { channelId: '-100' + match[1], messageId: match[2] };
  }
  return null;
}

async function checkSubscription(ctx) {
  const channel = db.getRequiredChannel();
  if (!channel) return true;
  
  try {
    const member = await ctx.telegram.getChatMember(channel.channel_id, ctx.from.id);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (e) {
    return false;
  }
}

function subscriptionKeyboard(channel) {
  return Markup.inlineKeyboard([
    [Markup.button.url('📢 Kanalga a\'zo bo\'lish', channel.channel_link)],
    [Markup.button.callback('✅ Tekshirish', 'check_sub')]
  ]);
}

function getAdText() {
  const ad = db.getActiveAd();
  if (ad) {
    return `\n\n📣 ${ad.ad_text}${ad.ad_link ? '\n' + ad.ad_link : ''}`;
  }
  return '';
}

let addMovieState = {};
let addSeriesState = {};

bot.command('start', async (ctx) => {
  db.trackUser(ctx.from.id, ctx.from.username);
  
  const channel = db.getRequiredChannel();
  if (channel) {
    const subscribed = await checkSubscription(ctx);
    if (!subscribed) {
      return ctx.reply(
        '🔒 Botdan foydalanish uchun majburiy kanalga a\'zo bo\'ling!',
        subscriptionKeyboard(channel)
      );
    }
  }
  
  ctx.reply('🎬 Sharq Movie botiga xush kelibsiz!', mainMenu);
});

bot.command('admin', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) {
    return ctx.reply('⛔ Siz admin emassiz.');
  }
  ctx.reply('🔐 Admin panel', adminMenu);
});

bot.hears('🎬 Kino qidirish', (ctx) => {
  ctx.reply('🎥 Kino kodini yoki nomini yozing:', Markup.removeKeyboard());
});

bot.hears('📺 Seriallar', (ctx) => {
  ctx.reply('📺 Serial nomini yozing:', Markup.removeKeyboard());
});

bot.hears('📞 Aloqa', (ctx) => {
  ctx.reply('📞 Admin bilan bog\'lanish:\n\n👤 @sharqtech_admin', 
    Markup.inlineKeyboard([[Markup.button.url('💬 Xabar yuborish', 'https://t.me/sharqtech_admin')]])
  );
});

bot.hears('📊 Statistika', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  const count = db.getUserCount();
  ctx.reply(`📊 Foydalanuvchilar: ${count}`, adminMenu);
});

bot.hears('⬅️ Asosiy menyu', (ctx) => {
  ctx.reply('🏠 Asosiy menyu', mainMenu);
});

bot.hears('➕ Kino qo\'shish', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  ctx.reply('➕ Kino qo\'shish uchun quyidagi formatda yuboring:\n\n/addmovie kod nomi link\n\nMisol:\n/addmovie 1023 Avatar https://t.me/c/1945678123/25');
});

bot.hears('➕ Serial qo\'shish', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  ctx.reply('➕ Serial qo\'shish uchun:\n\n/addseries nomi season episode link\n\nMisol:\n/addseries BreakingBad 1 1 https://t.me/c/1945678123/30');
});

bot.hears('🗑️ Kino o\'chirish', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  ctx.reply('🗑️ Kino o\'chirish uchun:\n\n/delmovie kod\n\nMisol:\n/delmovie 1023');
});

bot.hears('📢 Kanal qo\'shish', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  ctx.reply('📢 Majburiy kanal qo\'shish:\n\n/addchannel id link\n\nMisol:\n/addchannel -1001945678123 https://t.me/yourchannel');
});

bot.hears('📣 Reklama qo\'shish', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return;
  ctx.reply('📣 Reklama qo\'shish:\n\n/addad matn link\n\nMisol:\n/addad Kanalimiz https://t.me/yourchannel');
});

bot.command('addmovie', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply('⛔ Admin emassiz.');
  
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) {
    return ctx.reply('❌ Format: /addmovie kod nomi link');
  }
  
  const code = args[0];
  const name = args.slice(1, -1).join(' ');
  const link = args[args.length - 1];
  const parsed = parseChannelLink(link);
  
  if (!parsed) {
    return ctx.reply('❌ Link noto\'g\'ri. Format: https://t.me/c/CHANNEL_ID/MESSAGE_ID');
  }
  
  db.addMovie(code, name, parsed.channelId, parsed.messageId);
  ctx.reply(`✅ Kino qo'shildi!\n\n📛 ${name}\n🔢 Kod: ${code}`, adminMenu);
});

bot.command('addseries', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply('⛔ Admin emassiz.');
  
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 4) {
    return ctx.reply('❌ Format: /addseries nomi season episode link');
  }
  
  const name = args.slice(0, -3).join(' ');
  const season = parseInt(args[args.length - 3]);
  const episode = parseInt(args[args.length - 2]);
  const link = args[args.length - 1];
  const parsed = parseChannelLink(link);
  
  if (!parsed) return ctx.reply('❌ Link xato');
  
  db.addSeries(name, season, episode, parsed.channelId, parsed.messageId);
  ctx.reply(`✅ Serial qo'shildi!\n\n📺 ${name}\n📁 Season: ${season}\n🎬 Episode: ${episode}`, adminMenu);
});

bot.command('delmovie', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply('⛔ Admin emassiz.');
  
  const args = ctx.message.text.split(' ')[1];
  if (!args) return ctx.reply('❌ Format: /delmovie kod');
  
  const movie = db.getMovieByCode(args);
  if (!movie) return ctx.reply('❌ Kino topilmadi');
  
  db.deleteMovie(movie.id);
  ctx.reply(`✅ ${movie.movie_name} o'chirildi`, adminMenu);
});

bot.command('addchannel', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply('⛔ Admin emassiz.');
  
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) return ctx.reply('❌ Format: /addchannel id link');
  
  db.addChannel(args[0], args[1], 1);
  ctx.reply('✅ Kanal q\'oshildi!', adminMenu);
});

bot.command('addad', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply('⛔ Admin emassiz.');
  
  const text = ctx.message.text.replace('/addad', '').trim();
  if (!text) return ctx.reply('❌ Format: /addad matn [link]');
  
  let link = null;
  if (text.includes('http')) {
    const parts = text.match(/(.+)\s+(https?:\/\/\S+)/);
    if (parts) {
      text = parts[1].trim();
      link = parts[2];
    }
  }
  
  db.addAd(text, link);
  ctx.reply(`✅ Reklama qo'shildi!\n\n📣 ${text}${link ? '\n' + link : ''}`, adminMenu);
});

bot.command('broadcast', async (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply('⛔ Admin emassiz.');
  
  const message = ctx.message.text.replace('/broadcast', '').trim();
  if (!message) return ctx.reply('❌ Format: /broadcast xabar');
  
  const users = db.getAllUsers();
  let sent = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      await ctx.telegram.sendMessage(user.telegram_id, message);
      sent++;
    } catch (e) {
      failed++;
    }
  }
  
  ctx.reply(`✅ Yuborildi!\n\n🎯 Yuborildi: ${sent}\n❌ Xato: ${failed}`);
});

bot.command('stats', (ctx) => {
  if (String(ctx.from.id) !== ADMIN_ID) return ctx.reply('⛔ Admin emassiz.');
  const count = db.getUserCount();
  ctx.reply(`📊 Foydalanuvchilar: ${count}`);
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const userId = String(ctx.from.id);
  
  if (text.startsWith('/')) return;
  
  const channel = db.getRequiredChannel();
  if (channel) {
    const subscribed = await checkSubscription(ctx);
    if (!subscribed) {
      return ctx.reply(
        '🔒 Botdan foydalanish uchun majburiy kanalga a\'zo bo\'ling!',
        subscriptionKeyboard(channel)
      );
    }
  }
  
  if (/^\d+$/.test(text)) {
    const movie = db.getMovieByCode(text);
    if (movie) {
      try {
        await ctx.telegram.copyMessage(userId, movie.channel_id, movie.message_id);
        return ctx.reply(`🎬 ${movie.movie_name}${getAdText()}`, mainMenu);
      } catch (e) {
        return ctx.reply('❌ Xatolik');
      }
    }
    return ctx.reply('❌ Kino topilmadi', mainMenu);
  }
  
  const movies = db.searchMovies(text);
  if (movies.length > 0) {
    if (movies.length === 1) {
      try {
        await ctx.telegram.copyMessage(userId, movies[0].channel_id, movies[0].message_id);
        return ctx.reply(`🎬 ${movies[0].movie_name}${getAdText()}`, mainMenu);
      } catch (e) {
        return ctx.reply('❌ Xatolik');
      }
    }
    
    const buttons = movies.slice(0, 10).map(m => 
      [Markup.button.callback(m.movie_name, `movie_${m.id}`)]
    );
    return ctx.reply(`${movies.length} ta kino topildi:`, Markup.inlineKeyboard(buttons));
  }
  
  ctx.reply('❌ Kino topilmadi', mainMenu);
});

bot.action('check_sub', async (ctx) => {
  const channel = db.getRequiredChannel();
  if (!channel) return ctx.answerCallbackQuery('Kanal topilmadi');
  
  const subscribed = await checkSubscription(ctx);
  if (subscribed) {
    await ctx.editMessageText('✅ Xush kelibsiz!', { reply_markup: null });
    ctx.reply('🎬 Sharq Movie botiga xush kelibsiz!', mainMenu);
  } else {
    ctx.answerCallbackQuery('Hali a\'zo emassiz!', true);
  }
});

bot.action(/movie_(\d+)/, async (ctx) => {
  const movieId = parseInt(ctx.match[1]);
  const allMovies = db.getMovieByName('');
  const movie = allMovies.find(m => m.id === movieId);
  
  if (movie) {
    try {
      await ctx.telegram.copyMessage(ctx.from.id, movie.channel_id, movie.message_id);
      ctx.reply(`🎬 ${movie.movie_name}`, mainMenu);
    } catch (e) {
      ctx.reply('❌ Xatolik');
    }
  }
});

bot.launch();
console.log('🎬 Sharq Movie bot ishga tushdi');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
