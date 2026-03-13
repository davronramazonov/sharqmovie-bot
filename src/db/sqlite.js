const sqlite3 = require('better-sqlite3');
const path = require('path');

const db = new sqlite3(path.join(__dirname, '../../data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE,
    username TEXT,
    join_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_code TEXT UNIQUE,
    movie_name TEXT,
    channel_id TEXT,
    message_id TEXT
  );

  CREATE TABLE IF NOT EXISTS series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_name TEXT,
    season INTEGER,
    episode INTEGER,
    channel_id TEXT,
    message_id TEXT
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT,
    channel_link TEXT,
    is_required INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_text TEXT,
    ad_link TEXT,
    is_active INTEGER DEFAULT 1
  );
`);

function trackUser(telegramId, username) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (telegram_id, username) VALUES (?, ?)
  `);
  stmt.run(String(telegramId), username || null);
}

function getUserCount() {
  return db.prepare('SELECT COUNT(*) as count FROM users').get().count;
}

function getAllUsers() {
  return db.prepare('SELECT * FROM users').all();
}

function addMovie(movieCode, movieName, channelId, messageId) {
  const stmt = db.prepare(`
    INSERT INTO movies (movie_code, movie_name, channel_id, message_id)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(movieCode, movieName, channelId, messageId);
}

function getMovieByCode(movieCode) {
  return db.prepare('SELECT * FROM movies WHERE movie_code = ?').get(movieCode);
}

function getMovieByName(movieName) {
  const searchTerm = movieName.toLowerCase().trim();
  const words = searchTerm.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) return [];
  
  let query = 'SELECT * FROM movies WHERE LOWER(movie_name) LIKE ?';
  const params = [`%${words[0]}%`];
  
  for (let i = 1; i < words.length; i++) {
    query += ' AND LOWER(movie_name) LIKE ?';
    params.push(`%${words[i]}%`);
  }
  
  query += ' ORDER BY movie_name';
  
  return db.prepare(query).all(...params);
}

function searchMovies(query) {
  const searchTerm = query.toLowerCase().trim();
  if (!searchTerm) return [];
  
  const words = searchTerm.split(/\s+/).filter(w => w.length > 1);
  
  if (words.length === 0) {
    return db.prepare('SELECT * FROM movies WHERE LOWER(movie_name) LIKE ? ORDER BY movie_name').all(`%${searchTerm}%`);
  }
  
  let sql = 'SELECT * FROM movies WHERE ';
  const conditions = words.map(() => 'LOWER(movie_name) LIKE ?').join(' OR ');
  sql += conditions;
  sql += ' ORDER BY movie_name LIMIT 20';
  
  const params = words.map(w => `%${w}%`);
  return db.prepare(sql).all(...params);
}

function deleteMovie(id) {
  return db.prepare('DELETE FROM movies WHERE id = ?').run(id);
}

function addSeries(seriesName, season, episode, channelId, messageId) {
  const stmt = db.prepare(`
    INSERT INTO series (series_name, season, episode, channel_id, message_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(seriesName, season, episode, channelId, messageId);
}

function getSeries(seriesName, season) {
  return db.prepare('SELECT * FROM series WHERE series_name = ? AND season = ? ORDER BY episode').all(seriesName, season);
}

function getSeriesEpisodes(seriesName) {
  return db.prepare('SELECT DISTINCT season FROM series WHERE series_name = ? ORDER BY season').all(seriesName);
}

function getSeriesByEpisode(seriesName, season, episode) {
  return db.prepare('SELECT * FROM series WHERE series_name = ? AND season = ? AND episode = ?').get(seriesName, season, episode);
}

function addChannel(channelId, channelLink, isRequired = 0) {
  const stmt = db.prepare(`
    INSERT INTO channels (channel_id, channel_link, is_required)
    VALUES (?, ?, ?)
  `);
  return stmt.run(channelId, channelLink, isRequired);
}

function getRequiredChannel() {
  return db.prepare('SELECT * FROM channels WHERE is_required = 1').get();
}

function addAd(adText, adLink) {
  const stmt = db.prepare(`
    INSERT INTO ads (ad_text, ad_link) VALUES (?, ?)
  `);
  return stmt.run(adText, adLink);
}

function getActiveAd() {
  return db.prepare('SELECT * FROM ads WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1').get();
}

function deactivateAd(id) {
  return db.prepare('UPDATE ads SET is_active = 0 WHERE id = ?').run(id);
}

module.exports = {
  db,
  trackUser,
  getUserCount,
  getAllUsers,
  addMovie,
  getMovieByCode,
  getMovieByName,
  searchMovies,
  deleteMovie,
  addSeries,
  getSeries,
  getSeriesEpisodes,
  getSeriesByEpisode,
  addChannel,
  getRequiredChannel,
  addAd,
  getActiveAd,
  deactivateAd
};
