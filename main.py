import sqlite3
import random
import re
import os
import asyncio
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters

class HealthCheck(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')
    def log_message(self, *args): pass

def run_health_check():
    server = HTTPServer(('0.0.0.0', int(os.getenv('PORT', 8000))), HealthCheck)
    server.serve_forever()

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_IDS = [x.strip() for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()]
DB_PATH = "data.db"

def generate_code():
    while True:
        code = str(random.randint(100, 9999))
        if not get_movie_by_code(code):
            return code

def clean_title(title):
    title = re.sub(r'\(.*?\)|\[.*?\]|\{.*?\}', '', title)
    title = re.sub(r'\d{3,4}p|4k|uhd|hdr|rus|eng|uzb', '', title)
    title = re.sub(r'[-_.]', ' ', title)
    return title.strip().title()

def guess_genre(title):
    t = title.lower()
    g = {
        'Action':['action','jang','fight','war','military','sural'],
        'Comedy':['comedy','komediya','funny','kulguli'],
        'Horror':['horror','qorq','qo\'rq','qorqinchli'],
        'Drama':['drama','drammatic','tragik'],
        'Romance':['romance','sevgi','love','muhabbat'],
        'Sci-Fi':['sci-fi','fantastik','space','uzay'],
        'Animation':['animation','multfilm','anime','cartoon'],
        'Thriller':['thriller','qiziq','sir'],
        'Adventure':['adventure','sarguzasht','quest']
    }
    for k,v in g.items():
        for x in v:
            if x in t: return k
    return "Drama"

def guess_year(title):
    y = re.findall(r'(19\d{2}|20\d{2})', title)
    return y[0] if y else "2024"

def guess_quality(title):
    t = title.lower()
    if '4k' in t: return "4K"
    if 'hdr' in t: return "HDR"
    if '1080' in t: return "1080p"
    if '720' in t: return "720p"
    return "1080p"

conn = sqlite3.connect(DB_PATH)

def init_db():
    global conn
    conn.execute('''CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, user_id TEXT UNIQUE, username TEXT, joined_date DATETIME DEFAULT CURRENT_TIMESTAMP, blocked INTEGER DEFAULT 0, referrer_id TEXT, referals_count INTEGER DEFAULT 0)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS movies (id INTEGER PRIMARY KEY, movie_code TEXT UNIQUE, title TEXT, year TEXT, genre TEXT, studio_id INTEGER, file_id TEXT, quality TEXT, is_new INTEGER DEFAULT 0, is_popular INTEGER DEFAULT 0, category TEXT DEFAULT 'movie', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS series (id INTEGER PRIMARY KEY, title TEXT, season INTEGER, episode INTEGER, file_id TEXT, category TEXT DEFAULT 'series', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS studios (id INTEGER PRIMARY KEY, name TEXT UNIQUE, emoji TEXT DEFAULT '🎬')''')
    conn.execute('''CREATE TABLE IF NOT EXISTS channels (id INTEGER PRIMARY KEY, channel_id TEXT, channel_link TEXT, is_required INTEGER DEFAULT 0, is_public INTEGER DEFAULT 0)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS ads (id INTEGER PRIMARY KEY, ad_text TEXT, ad_link TEXT, is_active INTEGER DEFAULT 1)''')
    conn.commit()

def db():
    return conn

def is_admin(uid): 
    result = str(uid) in ADMIN_IDS
    print(f"DEBUG is_admin: uid={uid}, type={type(uid)}, str_uid={str(uid)}, ADMIN_IDS={ADMIN_IDS}, result={result}")
    return result

def track_user(uid, uname, ref=None):
    c = conn.cursor()
    ex = c.execute("SELECT * FROM users WHERE user_id = ?", (str(uid),)).fetchone()
    if ex:
        if ex[4] == 1:
            c.execute("UPDATE users SET blocked = 0 WHERE user_id = ?", (str(uid),))
            conn.commit()
    else:
        if ref and str(ref) != str(uid):
            c.execute("UPDATE users SET referals_count = referals_count + 1 WHERE user_id = ?", (str(ref),))
            conn.commit()
        c.execute("INSERT INTO users (user_id, username, referrer_id) VALUES (?, ?, ?)", (str(uid), uname, str(ref) if ref else None))
        conn.commit()

def get_users():
    c = conn.cursor()
    return c.execute("SELECT * FROM users").fetchall()

def get_user_count():
    c = conn.cursor()
    return c.execute("SELECT COUNT(*) FROM users WHERE blocked = 0").fetchone()[0]

def get_movie_count():
    c = conn.cursor()
    return c.execute("SELECT COUNT(*) FROM movies WHERE category = 'movie'").fetchone()[0]

def get_series_count():
    c = conn.cursor()
    return c.execute("SELECT COUNT(DISTINCT title) FROM series").fetchone()[0]

def add_movie(title, year, genre, fid, quality, cat='movie'):
    code = generate_code()
    c = conn.cursor()
    c.execute("INSERT INTO movies (movie_code, title, year, genre, file_id, quality, category) VALUES (?, ?, ?, ?, ?, ?, ?)", (code, title, year, genre, fid, quality, cat))
    conn.commit()
    return code

def get_movie_by_code(code):
    c = conn.cursor()
    return c.execute("SELECT * FROM movies WHERE movie_code = ?", (str(code),)).fetchone()

def get_movie_by_id(id):
    c = conn.cursor()
    return c.execute("SELECT * FROM movies WHERE id = ?", (id,)).fetchone()

def get_new_movies():
    c = conn.cursor()
    return c.execute("SELECT * FROM movies WHERE is_new = 1 AND category = 'movie' ORDER BY id DESC LIMIT 20").fetchall()

def get_all_movies():
    c = conn.cursor()
    return c.execute("SELECT * FROM movies WHERE category = 'movie' ORDER BY id DESC LIMIT 100").fetchall()

def get_movies_by_cat(cat):
    c = conn.cursor()
    return c.execute("SELECT * FROM movies WHERE category = ? ORDER BY id DESC LIMIT 20", (cat,)).fetchall()

def get_movies_by_studio(sid):
    c = conn.cursor()
    return c.execute("SELECT * FROM movies WHERE studio_id = ? AND category = 'movie' ORDER BY id DESC", (sid,)).fetchall()

def get_all_series():
    c = conn.cursor()
    return c.execute("SELECT DISTINCT title FROM series ORDER BY title").fetchall()

def get_series(title):
    c = conn.cursor()
    return c.execute("SELECT * FROM series WHERE title = ? ORDER BY season, episode", (title,)).fetchall()

def get_series_episodes(title, season):
    c = conn.cursor()
    return c.execute("SELECT * FROM series WHERE title = ? AND season = ? ORDER BY episode", (title, season)).fetchall()

def get_series_by_id(id):
    c = conn.cursor()
    return c.execute("SELECT * FROM series WHERE id = ?", (id,)).fetchone()

def add_series(title, season, episode, fid):
    c = conn.cursor()
    c.execute("INSERT INTO series (title, season, episode, file_id) VALUES (?, ?, ?, ?)", (title, season, episode, fid))
    conn.commit()

def get_studios():
    c = conn.cursor()
    return c.execute("SELECT * FROM studios ORDER BY name").fetchall()

def get_studio_by_id(id):
    c = conn.cursor()
    return c.execute("SELECT * FROM studios WHERE id = ?", (id,)).fetchone()

def add_studio(name, emoji='🎬'):
    try:
        c = conn.cursor()
        c.execute("INSERT INTO studios (name, emoji) VALUES (?, ?)", (name, emoji))
        conn.commit()
        return c.lastrowid
    except:
        return None

def delete_studio(id):
    c = conn.cursor()
    c.execute("DELETE FROM studios WHERE id = ?", (id,))
    conn.commit()

def get_required_channels():
    c = conn.cursor()
    return c.execute("SELECT * FROM channels WHERE is_required = 1").fetchall()

def get_public_channel():
    c = conn.cursor()
    return c.execute("SELECT * FROM channels WHERE is_public = 1").fetchone()

def get_all_channels():
    c = conn.cursor()
    return c.execute("SELECT * FROM channels").fetchall()

def add_channel(cid, link, req=0, pub=0):
    c = conn.cursor()
    c.execute("INSERT INTO channels (channel_id, channel_link, is_required, is_public) VALUES (?, ?, ?, ?)", (cid, link, req, pub))
    conn.commit()

def get_active_ad():
    c = conn.cursor()
    ad = c.execute("SELECT * FROM ads WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1").fetchone()
    if ad:
        link = f"\n{ad[2]}" if ad[2] else ""
        return f"\n\n📣 {ad[1]}{link}"
    return ''

MENU = [[KeyboardButton("🎬 Kinolar")],[KeyboardButton("🎞 Multfilmlar")],[KeyboardButton("📺 Seriallar")],[KeyboardButton("🎥 Studiyalar")],[KeyboardButton("❓ Qanday ishlaydi")],[KeyboardButton("📞 Aloqa")]]
MOVIES = [[KeyboardButton("🔥 Yangi")],[KeyboardButton("📂 Barchasi")],[KeyboardButton("⬅️ Orqaga")]]
CARTOONS = [[KeyboardButton("🐭 Disney")],[KeyboardButton("🐼 Pixar")],[KeyboardButton("🐉 Anime")],[KeyboardButton("⬅️ Orqaga")]]
ADMIN = [[KeyboardButton("📊 Statistika")],[KeyboardButton("📹 Kino +")],[KeyboardButton("📺 Serial +")],[KeyboardButton("🎥 Studio +")],[KeyboardButton("❌ Studio -")],[KeyboardButton("📢 Kanal")],[KeyboardButton("📣 Reklama")],[KeyboardButton("⬅️ Orqaga")]]

async def start(update, ctx):
    u = update.effective_user
    args = update.message.text.split()
    code = ref = None
    for a in args[1:]:
        if a.isdigit() and len(a) > 5: ref = a
        elif a.isdigit(): code = a
    track_user(u.id, u.username, ref)
    for ch in get_required_channels():
        try:
            m = await ctx.bot.get_chat_member(ch[1], u.id)
            if m.status not in ['member','administrator','creator']:
                kb = [[InlineKeyboardButton(ch[2], url=ch[2])],[InlineKeyboardButton("✅ Tekshirish","check_sub")]]
                await update.message.reply_text("🔒 Kanallarga obuna bo'ling:", reply_markup=InlineKeyboardMarkup(kb))
                return
        except: pass
    if code:
        m = get_movie_by_code(code)
        if m and m[6]:
            await ctx.bot.send_video(u.id, m[6], caption=f"🎬 {m[2]}\n📅 {m[3]} | 🎭 {m[4]} | 📺 {m[7]}\n🔢 {m[1]}{get_active_ad()}")
            await update.message.reply_text("🏠 Asosiy menyu", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
            return
    await update.message.reply_text("🎬 Sharq Movie\n\n📝 Kod yozing (masalan: 123)", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))

async def admin(update, ctx):
    print(f"DEBUG admin called by: {update.effective_user.id}")
    if not is_admin(update.effective_user.id): 
        print("DEBUG: not admin, returning")
        return
    print("DEBUG: is admin, sending panel")
    await update.message.reply_text("🔐 Admin panel", reply_markup=ReplyKeyboardMarkup(ADMIN, resize_keyboard=True))

async def text(update, ctx):
    t = update.message.text.strip()
    u = update.effective_user
    if t.startswith('/'): return
    
    if is_admin(u.id):
        if t == "📊 Statistika":
            await update.message.reply_text(f"📊 Statistika\n\n👥 {get_user_count()}\n🎬 {get_movie_count()}\n📺 {get_series_count()}", reply_markup=ReplyKeyboardMarkup(ADMIN, resize_keyboard=True))
        elif t == "📹 Kino +": await update.message.reply_text("📹 Video yuboring", reply_markup=ReplyKeyboardMarkup(ADMIN, resize_keyboard=True))
        elif t == "📺 Serial +": await update.message.reply_text("📹 Video + caption:\n#serial\nnom\nseason:1\nepisode:1", reply_markup=ReplyKeyboardMarkup(ADMIN, resize_keyboard=True))
        elif t == "🎥 Studio +": await update.message.reply_text("🎥 /studio_add 🔴 Nom", reply_markup=ReplyKeyboardMarkup(ADMIN, resize_keyboard=True))
        elif t == "❌ Studio -":
            ss = get_studios()
            if ss:
                kb = [[InlineKeyboardButton(f"❌ {s[1]}", callback_data=f"ds_{s[0]}")] for s in ss]
                await update.message.reply_text("Tanlang:", reply_markup=InlineKeyboardMarkup(kb))
        elif t == "📢 Kanal":
            chs = get_all_channels()
            m = "📢 Kanallar:\n"
            for i,c in enumerate(chs): m += f"{i+1}. {c[2]}\n"
            m += "\n/addchannel -100ID https://t.me/kanal"
            await update.message.reply_text(m, reply_markup=ReplyKeyboardMarkup(ADMIN, resize_keyboard=True))
        elif t == "📣 Reklama": await update.message.reply_text("📣 /broadcast xabar", reply_markup=ReplyKeyboardMarkup(ADMIN, resize_keyboard=True))
        elif t == "⬅️ Orqaga": await update.message.reply_text("🏠 Asosiy menyu", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
        return
    
    for ch in get_required_channels():
        try:
            m = await ctx.bot.get_chat_member(ch[1], u.id)
            if m.status not in ['member','administrator','creator']:
                kb = [[InlineKeyboardButton(ch[2], url=ch[2])],[InlineKeyboardButton("✅ Tekshirish","check_sub")]]
                await update.message.reply_text("🔒 Kanallarga obuna bo'ling:", reply_markup=InlineKeyboardMarkup(kb))
                return
        except: pass
    
    if t == "🎬 Kinolar": await update.message.reply_text("🎬 Kinolar", reply_markup=ReplyKeyboardMarkup(MOVIES, resize_keyboard=True))
    elif t == "🎞 Multfilmlar": await update.message.reply_text("🎞 Multfilmlar", reply_markup=ReplyKeyboardMarkup(CARTOONS, resize_keyboard=True))
    elif t == "📺 Seriallar":
        sl = get_all_series()
        if sl:
            kb = [[InlineKeyboardButton(f"📺 {s[0]}", callback_data=f"s_{s[0]}")] for s in sl]
            kb.append([InlineKeyboardButton("⬅️ Orqaga","back_main")])
            await update.message.reply_text("📺 Seriallar", reply_markup=InlineKeyboardMarkup(kb))
        else: await update.message.reply_text("📺 Seriallar yo'q", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
    elif t == "🎥 Studiyalar":
        ss = get_studios()
        if ss:
            kb = [[InlineKeyboardButton(f"{s[2]} {s[1]}", callback_data=f"st_{s[0]}")] for s in ss]
            kb.append([InlineKeyboardButton("⬅️ Orqaga","back_main")])
            await update.message.reply_text("🎥 Studiyalar", reply_markup=InlineKeyboardMarkup(kb))
        else: await update.message.reply_text("🎥 Studiyalar yo'q", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
    elif t == "❓ Qanday ishlaydi": await update.message.reply_text("📖 *Qo'llanma*\n\n🎬 *Kinolar* - Ro'yxatdan kerakli kinoni tanlang\n\n🎞 *Multfilmlar* - Disney, Pixar, Anime\n\n📺 *Seriallar* - Barcha seriallar\n\n🎥 *Studiyalar* - Kinostudiyalar bo'yicha qidiruv\n\n🔢 *Kod bilan qidiruv* - Botga 3-4 xonali kod yozing\n\n📌 Har bir kinoning noyob kodi bor. Kod orqali to'g'ridan-to'g'ri kino ochiladi.\n\n_Misol: 123, 4567_", parse_mode="Markdown", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
    elif t == "📞 Aloqa": await update.message.reply_text("📞 Aloqa: @sharqtech_admin", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
    elif t == "⬅️ Orqaga": await update.message.reply_text("🏠 Asosiy menyu", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
    elif t == "🔥 Yangi":
        ms = get_new_movies()
        await show_movies(update, ctx, ms, "🔥 Yangi kinolar")
    elif t == "📂 Barchasi":
        ms = get_all_movies()
        await show_movies(update, ctx, ms, "📂 Barcha kinolar")
    elif t == "🐭 Disney":
        ms = get_movies_by_cat('cartoon_disney')
        await show_movies(update, ctx, ms, "🐭 Disney")
    elif t == "🐼 Pixar":
        ms = get_movies_by_cat('cartoon_pixar')
        await show_movies(update, ctx, ms, "🐼 Pixar")
    elif t == "🐉 Anime":
        ms = get_movies_by_cat('cartoon_anime')
        await show_movies(update, ctx, ms, "🐉 Anime")
    else:
        if t.isdigit():
            m = get_movie_by_code(t)
            if m and m[6]:
                await ctx.bot.send_video(u.id, m[6], caption=f"🎬 {m[2]}\n📅 {m[3]} | 🎭 {m[4]} | 📺 {m[7]}\n🔢 {m[1]}{get_active_ad()}")
            else:
                await update.message.reply_text(f"❌ {t} - topilmadi", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
        else:
            await update.message.reply_text("❌ Faqat kod yozing (123)", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))

async def show_movies(update, ctx, movies, title):
    if not movies:
        await ctx.bot.send_message(chat_id=update.effective_user.id, text=f"{title}\n\nKino yo'q", reply_markup=ReplyKeyboardMarkup(MOVIES, resize_keyboard=True))
        return
    msg = f"{title}\n\n"
    for i,m in enumerate(movies): msg += f"{i+1}. 🎬 {m[2]} 🔢{m[1]}\n"
    kb = [[InlineKeyboardButton(f"🎬 {m[2]}", callback_data=f"w_{m[1]}")] for m in movies[:8]]
    kb.append([InlineKeyboardButton("⬅️ Orqaga","back_movies")])
    await ctx.bot.send_message(chat_id=update.effective_user.id, text=msg, reply_markup=InlineKeyboardMarkup(kb))

async def video(update, ctx):
    if not is_admin(update.effective_user.id): return
    try:
        fid = update.message.video.file_id
        cap = update.message.caption or ''
        fn = update.message.video.file_name if hasattr(update.message.video, 'file_name') else ''
        name = cap.strip() if cap else (fn or 'Noma\'lum Film')
        name = clean_title(name)
        year = guess_year(name)
        genre = guess_genre(name)
        qual = guess_quality(name)
        cat = 'movie'
        if 'disney' in name.lower(): cat = 'cartoon_disney'
        elif 'pixar' in name.lower(): cat = 'cartoon_pixar'
        elif 'anime' in name.lower(): cat = 'cartoon_anime'
        code = add_movie(name, year, genre, fid, qual, cat)
        await update.message.reply_text(f"✅ Qo'shildi!\n\n📛 {name}\n📅 {year}\n🎭 {genre}\n📺 {qual}\n🔢 {code}", reply_markup=ReplyKeyboardMarkup(ADMIN, resize_keyboard=True))
    except Exception as e:
        await update.message.reply_text(f"❌ Xatolik: {str(e)}")

async def callback(update, ctx):
    q = update.callback_query
    await q.answer()
    d = q.data
    u = q.from_user
    if d == "check_sub":
        ok = True
        for ch in get_required_channels():
            try:
                m = await ctx.bot.get_chat_member(ch[1], u.id)
                if m.status not in ['member','administrator','creator']: ok = False; break
            except: ok = False; break
        if ok:
            await q.edit_message_text("✅ Xush kelibsiz!")
            await ctx.bot.send_message(u.id, "🎬 Sharq Movie", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
        else: await q.answer("A'zo emassiz!", show_alert=True)
    elif d == "back_main":
        await q.edit_message_text("🏠 Asosiy menyu")
        await ctx.bot.send_message(u.id, "🏠 Asosiy menyu", reply_markup=ReplyKeyboardMarkup(MENU, resize_keyboard=True))
    elif d == "back_movies":
        await q.edit_message_text("🎬 Kinolar")
        await ctx.bot.send_message(u.id, "🎬 Kinolar", reply_markup=ReplyKeyboardMarkup(MOVIES, resize_keyboard=True))
    elif d.startswith("w_"):
        code = d[2:]
        m = get_movie_by_code(code)
        if m and m[6]:
            await ctx.bot.send_video(u.id, m[6], caption=f"🎬 {m[2]}\n📅 {m[3]} | 🎭 {m[4]} | 📺 {m[7]}\n🔢 {m[1]}{get_active_ad()}")
        else: await ctx.bot.send_message(u.id, "❌ Topilmadi")
    elif d.startswith("st_"):
        sid = int(d[3:])
        s = get_studio_by_id(sid)
        if s:
            ms = get_movies_by_studio(sid)
            if ms:
                msg = f"{s[2]} {s[1]}\n\n"
                for i,m in enumerate(ms): msg += f"{i+1}. 🎬 {m[2]} 🔢{m[1]}\n"
                kb = [[InlineKeyboardButton(f"🎬 {m[2]}", callback_data=f"w_{m[1]}")] for m in ms[:8]]
                kb.append([InlineKeyboardButton("⬅️ Orqaga","back_main")])
                await q.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(kb))
            else: await q.answer("Kino yo'q", show_alert=True)
    elif d.startswith("s_"):
        title = d[2:]
        eps = get_series(title)
        if eps:
            ss = sorted(set(e[2] for e in eps))
            kb = [[InlineKeyboardButton(f"📁 Season {s}", callback_data=f"ss_{title}_{s}")] for s in ss]
            kb.append([InlineKeyboardButton("⬅️ Orqaga","back_main")])
            await q.edit_message_text(f"📺 {title}\n\nSeason tanlang:", reply_markup=InlineKeyboardMarkup(kb))
    elif d.startswith("ss_"):
        parts = d[3:].rsplit('_', 1)
        title, season = '_'.join(parts[:-1]), int(parts[-1])
        eps = get_series_episodes(title, season)
        if eps:
            kb = [[InlineKeyboardButton(f"🎬 {e[2]}-{e[3]}", callback_data=f"ws_{e[0]}")] for e in eps]
            kb.append([InlineKeyboardButton("⬅️ Orqaga", f"s_{title}")])
            await q.edit_message_text(f"📺 {title} - Season {season}", reply_markup=InlineKeyboardMarkup(kb))
    elif d.startswith("ws_"):
        eid = int(d[3:])
        ep = get_series_by_id(eid)
        if ep and ep[4]:
            await ctx.bot.send_video(u.id, ep[4], caption=f"📺 {ep[1]}\n📁 S{ep[2]} E{ep[3]}{get_active_ad()}")
    elif d.startswith("ds_"):
        if is_admin(u.id):
            sid = int(d[3:])
            s = get_studio_by_id(sid)
            if s:
                delete_studio(sid)
                await q.edit_message_text(f"✅ {s[1]} o'chirildi")
                await ctx.bot.send_message(u.id, "🔐 Admin panel", reply_markup=ReplyKeyboardMarkup(ADMIN, resize_keyboard=True))

async def studio_add(update, ctx):
    if not is_admin(update.effective_user.id): return
    args = update.message.text.split()[1:]
    if not args: await update.message.reply_text("❌ /studio_add 🔴 Nom"); return
    emoji = '🎬'
    name = ' '.join(args)
    if args[0] in ['🔴','🔵','⚔️','🦍','🐭','🐼','🐉']: emoji = args[0]; name = ' '.join(args[1:])
    r = add_studio(name, emoji)
    if r: await update.message.reply_text(f"✅ {emoji} {name}")
    else: await update.message.reply_text("❌ Mavjud")

async def addchannel(update, ctx):
    if not is_admin(update.effective_user.id): return
    args = update.message.text.split()[1:]
    if len(args) >= 2:
        add_channel(args[0], args[1], 1, 0)
        await update.message.reply_text("✅ Majburiy kanal qo'shildi")

async def broadcast(update, ctx):
    if not is_admin(update.effective_user.id): return
    msg = update.message.text.replace('/broadcast', '').strip()
    if msg:
        sent = failed = 0
        for u in get_users():
            try:
                await ctx.bot.send_message(u[1], msg)
                sent += 1
            except: failed += 1
        await update.message.reply_text(f"✅ Yuborildi!\n🎯 {sent} ❌ {failed}")

async def post(update, ctx):
    if not is_admin(update.effective_user.id): return
    msg = update.message.text.replace('/post', '').strip()
    ch = get_public_channel()
    if ch and msg:
        kb = [[InlineKeyboardButton("🎬 Tomosha", url=f"https://t.me/SharqMovieBot?start={update.effective_user.id}")]]
        try:
            await ctx.bot.send_message(ch[1], msg, reply_markup=InlineKeyboardMarkup(kb))
            await update.message.reply_text("✅ Post yuborildi!")
        except Exception as e:
            await update.message.reply_text(f"❌ {e}")

init_db()
print(f"Database tayyor. Kinolar: {get_movie_count()}")
app = Application.builder().token(BOT_TOKEN).build()
app.add_handler(CommandHandler("start", start))
app.add_handler(CommandHandler("admin", admin))
app.add_handler(CommandHandler("studio_add", studio_add))
app.add_handler(CommandHandler("addchannel", addchannel))
app.add_handler(CommandHandler("broadcast", broadcast))
app.add_handler(CommandHandler("post", post))
app.add_handler(MessageHandler(filters.VIDEO, video))
app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text))
app.add_handler(CallbackQueryHandler(callback))
Thread(target=run_health_check, daemon=True).start()
print(f"Sharq Movie Bot ishga tushdi! Port: {os.getenv('PORT', 8000)}")
app.run_polling()
