const { Markup } = require('telegraf');
const { mainMenu, adminMenu } = require('../keyboards');
const state = require('../state');
const db = require('../../db/sqlite');
const env = require('../../config/env');

const ADMIN_ID = env.ADMIN_ID;

function isAdmin(ctx) {
  return String(ctx.from.id) === ADMIN_ID;
}

function parseChannelLink(link) {
  const match = link.match(/t\.me\/c\/(\d+)\/(\d+)/);
  if (match) {
    return { channelId: '-100' + match[1], messageId: match[2] };
  }
  return null;
}

function checkSubscription(ctx, channel) {
  return ctx.telegram.getChatMember(channel.channel_id, ctx.from.id);
}

async function requireSubscription(ctx) {
  const channel = db.getRequiredChannel();
  if (!channel) return true;

  try {
    const membership = await checkSubscription(ctx, channel);
    return membership.status === 'member' || membership.status === 'administrator' || membership.status === 'creator';
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

module.exports = function movieHandlers(bot) {
  bot.command('start', async (ctx) => {
    db.trackUser(ctx.from.id, ctx.from.username);
    
    const channel = db.getRequiredChannel();
    if (channel) {
      const subscribed = await requireSubscription(ctx);
      if (!subscribed) {
        return ctx.reply(
          '🔒 Botdan foydalanish uchun majburiy kanalga a\'zo bo\'ling!',
          subscriptionKeyboard(channel)
        );
      }
    }

    ctx.reply('🎬 Sharq Movie botiga xush kelibsiz!', mainMenu);
  });

  bot.action('check_sub', async (ctx) => {
    const channel = db.getRequiredChannel();
    if (!channel) {
      return ctx.answerCallbackQuery('Kanal topilmadi');
    }

    const subscribed = await requireSubscription(ctx);
    if (subscribed) {
      await ctx.editMessageText('✅ Xush kelibsiz!', { reply_markup: null });
      ctx.reply('🎬 Sharq Movie botiga xush kelibsiz!', mainMenu);
    } else {
      ctx.answerCallbackQuery('Hali a\'zo emassiz!', true);
    }
  });

  bot.hears('🎬 Kino qidirish', (ctx) => {
    state.searchMode[ctx.from.id] = 'movie';
    ctx.reply('🎥 Kino kodini yoki nomini yozing:', Markup.removeKeyboard());
  });

  bot.hears('📺 Seriallar', (ctx) => {
    state.searchMode[ctx.from.id] = 'series';
    ctx.reply('📺 Serial nomini yozing:', Markup.removeKeyboard());
  });

  bot.hears('📞 Aloqa', (ctx) => {
    ctx.reply(
      '📞 Admin bilan bog\'lanish:\n\n👤 @sharqtech_admin',
      Markup.inlineKeyboard([
        [Markup.button.url('💬 Xabar yuborish', 'https://t.me/sharqtech_admin')]
      ])
    );
  });

  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    const channel = db.getRequiredChannel();
    if (channel) {
      const subscribed = await requireSubscription(ctx);
      if (!subscribed) {
        return ctx.reply(
          '🔒 Botdan foydalanish uchun majburiy kanalga a\'zo bo\'ling!',
          subscriptionKeyboard(channel)
        );
      }
    }

    const addMovieState = state.addMovie[userId];
    if (addMovieState) {
      if (!isAdmin(ctx)) {
        delete state.addMovie[userId];
        return ctx.reply('⛔ Siz admin emassiz.');
      }

      const { channelId, messageId } = parseChannelLink(text);
      if (!channelId || !messageId) {
        return ctx.reply('❌ Noto\'g\'ri link formati. To\'g\'ri format: https://t.me/c/CHANNEL_ID/MESSAGE_ID');
      }

      db.addMovie(addMovieState.code, addMovieState.name, channelId, messageId);
      delete state.addMovie[userId];
      return ctx.reply(`✅ Kino qo'shildi!\n\n📛 Nomi: ${addMovieState.name}\n🔢 Kod: ${addMovieState.code}`, adminMenu);
    }

    const addSeriesState = state.addSeries[userId];
    if (addSeriesState) {
      if (!isAdmin(ctx)) {
        delete state.addSeries[userId];
        return ctx.reply('⛔ Siz admin emassiz.');
      }

      const { channelId, messageId } = parseChannelLink(text);
      if (!channelId || !messageId) {
        return ctx.reply('❌ Noto\'g\'ri link formati.');
      }

      db.addSeries(addSeriesState.name, addSeriesState.season, addSeriesState.episode, channelId, messageId);
      delete state.addSeries[userId];
      return ctx.reply(`✅ Serial qo'shildi!\n\n📺 ${addSeriesState.name}\n📁 Season: ${addSeriesState.season}\n🎬 Episode: ${addSeriesState.episode}`, adminMenu);
    }

    const addChannelState = state.addChannel[userId];
    if (addChannelState) {
      if (!isAdmin(ctx)) {
        delete state.addChannel[userId];
        return ctx.reply('⛔ Siz admin emassiz.');
      }

      const parts = text.split(' ');
      if (parts.length < 2) {
        return ctx.reply('❌ Format: channel_id channel_link');
      }

      db.addChannel(parts[0], parts[1], addChannelState.isRequired ? 1 : 0);
      delete state.addChannel[userId];
      return ctx.reply('✅ Kanal q\'oshildi!', adminMenu);
    }

    const addAdState = state.addAd[userId];
    if (addAdState) {
      if (!isAdmin(ctx)) {
        delete state.addAd[userId];
        return ctx.reply('⛔ Siz admin emassiz.');
      }

      db.addAd(addAdState.text, text);
      delete state.addAd[userId];
      return ctx.reply('✅ Reklama q\'oshildi!', adminMenu);
    }

    if (/^\d+$/.test(text)) {
      const movie = db.getMovieByCode(text);
      if (movie) {
        const ad = db.getActiveAd();
        let adText = '';
        if (ad) {
          adText = `\n\n📣 ${ad.ad_text}`;
          if (ad.ad_link) adText += `\n${ad.ad_link}`;
        }

        try {
          await ctx.telegram.copyMessage(userId, movie.channel_id, movie.message_id);
          return ctx.reply(`🎬 ${movie.movie_name}\n🔢 Kod: ${movie.movie_code}${adText}`, mainMenu);
        } catch (e) {
          return ctx.reply('❌ Kino topilmadi yoki yuborishda xatolik yuz berdi.', mainMenu);
        }
      }
    }

    const searchMode = state.searchMode[userId];
    if (searchMode === 'movie') {
      let movie = db.getMovieByCode(text);
      if (!movie) {
        const movies = db.getMovieByName(text);
        if (movies.length === 1) {
          movie = movies[0];
        } else if (movies.length > 1) {
          const buttons = movies.map(m => [Markup.button.callback(m.movie_name, `movie_${m.id}`)]);
          return ctx.reply('Bir nechta kino topildi:', Markup.inlineKeyboard(buttons));
        }
      }

      if (movie) {
        const ad = db.getActiveAd();
        let adText = '';
        if (ad) {
          adText = `\n\n📣 ${ad.ad_text}`;
          if (ad.ad_link) adText += `\n${ad.ad_link}`;
        }

        try {
          await ctx.telegram.copyMessage(userId, movie.channel_id, movie.message_id);
          ctx.reply(`🎬 ${movie.movie_name}\n🔢 Kod: ${movie.movie_code}${adText}`, mainMenu);
        } catch (e) {
          ctx.reply('❌ Kino topilmadi yoki yuborishda xatolik yuz berdi.', mainMenu);
        }
      } else {
        ctx.reply('❌ Kino topilmadi.', mainMenu);
      }
      delete state.searchMode[userId];
    }

    if (searchMode === 'series') {
      const episodes = db.getSeriesEpisodes(text);
      if (episodes.length === 0) {
        return ctx.reply('❌ Serial topilmadi.', mainMenu);
      }

      state.seriesSearch[userId] = { name: text, season: episodes[0].season };
      const buttons = episodes.map(s => [Markup.button.callback(`📁 Season ${s.season}`, `series_s${s.season}_${text}`)]);
      buttons.push([Markup.button.callback('⬅️ Ortga', 'back_to_menu')]);
      
      ctx.reply('📺 Season tanlang:', Markup.inlineKeyboard(buttons));
      delete state.searchMode[userId];
    }
  });

  bot.action(/series_s(\d+)_(.+)/, async (ctx) => {
    const season = parseInt(ctx.match[1]);
    const name = ctx.match[2];
    const userId = ctx.from.id;

    state.seriesSearch[userId] = { name, season };

    const episodes = db.getSeries(name, season);
    const buttons = episodes.map(ep => [Markup.button.callback(`🎬 ${season}-season ${ep.episode}-qism`, `episode_${name}_${season}_${ep.episode}`)]);
    
    const allSeasons = db.getSeriesEpisodes(name);
    if (allSeasons.length > 1) {
      const seasonBtns = allSeasons.map(s => [Markup.button.callback(`📁 Season ${s.season}`, `series_s${s.season}_${name}`)]);
      buttons.push(...seasonBtns);
    }
    buttons.push([Markup.button.callback('⬅️ Ortga', 'back_to_menu')]);

    await ctx.editMessageText(`📺 ${name} - Season ${season}`, { reply_markup: { inline_keyboard: buttons } });
  });

  bot.action(/episode_(.+)_(\d+)_(\d+)/, async (ctx) => {
    const name = ctx.match[1];
    const season = parseInt(ctx.match[2]);
    const episode = parseInt(ctx.match[3]);
    const userId = ctx.from.id;

    const movie = db.getSeriesByEpisode(name, season, episode);
    if (!movie) {
      return ctx.answerCallbackQuery('Episode topilmadi', true);
    }

    state.seriesSearch[userId] = { name, season, episode };

    const episodes = db.getSeries(name, season);
    const currentIndex = episodes.findIndex(ep => ep.episode === episode);

    const buttons = [];
    if (currentIndex > 0) {
      buttons.push(Markup.button.callback('⬅️ Oldingi qism', `episode_${name}_${season}_${episodes[currentIndex - 1].episode}`));
    }
    buttons.push(Markup.button.callback('🔢 Qism tanlash', `series_s${season}_${name}`));
    if (currentIndex < episodes.length - 1) {
      buttons.push(Markup.button.callback('➡️ Keyingi qism', `episode_${name}_${season}_${episodes[currentIndex + 1].episode}`));
    }

    try {
      await ctx.telegram.copyMessage(userId, movie.channel_id, movie.message_id);
      ctx.reply(`📺 ${name} - Season ${season} - Episode ${episode}`, { reply_markup: { inline_keyboard: [buttons] } });
    } catch (e) {
      ctx.reply('❌ Xatolik yuz berdi.', mainMenu);
    }
  });

  bot.action('back_to_menu', (ctx) => {
    ctx.editMessageText('🎬 Sharq Movie botiga xush kelibsiz!', { reply_markup: null });
  });

  bot.action(/movie_(\d+)/, async (ctx) => {
    const movieId = ctx.match[1];
    const movie = db.getMovieByCode(movieId);
    if (!movie) {
      const movies = db.getMovieByName('');
      const found = movies.find(m => m.id === parseInt(movieId));
      if (found) {
        try {
          await ctx.telegram.copyMessage(ctx.from.id, found.channel_id, found.message_id);
          return ctx.reply(`🎬 ${found.movie_name}`, mainMenu);
        } catch (e) {
          return ctx.reply('❌ Xatolik yuz berdi.', mainMenu);
        }
      }
      return ctx.answerCallbackQuery('Kino topilmadi', true);
    }

    try {
      await ctx.telegram.copyMessage(ctx.from.id, movie.channel_id, movie.message_id);
      ctx.reply(`🎬 ${movie.movie_name}`, mainMenu);
    } catch (e) {
      ctx.reply('❌ Xatolik yuz berdi.', mainMenu);
    }
  });

  if (!bot.state) bot.state = {};
  bot.state.isAdmin = isAdmin;
  bot.state.requireSubscription = requireSubscription;
};
