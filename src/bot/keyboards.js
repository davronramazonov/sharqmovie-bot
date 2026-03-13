const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
  ['🎬 Kino qidirish'],
  ['📺 Seriallar'],
  ['📞 Aloqa']
]).resize();

const adminMenu = Markup.keyboard([
  ['📊 Statistika'],
  ['/addmovie', '/addseries'],
  ['/delmovie', '/addchannel'],
  ['/addad'],
  ['⬅️ Asosiy menyu']
]).resize();

const cancelMenu = Markup.keyboard([
  ['❌ Bekor qilish']
]).resize();

module.exports = {
  mainMenu,
  adminMenu,
  cancelMenu
};
