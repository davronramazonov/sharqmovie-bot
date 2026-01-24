const { Markup } = require('telegraf');

// ===== ASOSIY MENYU =====
const mainMenu = Markup.keyboard([
  ['📥 Buyurtma berish'],
  ['❓ Savollar', '🤝 Homiylik'],
  ['ℹ️ Biz haqimizda', '📞 Aloqa']
]).resize();

// ===== ADMIN MENYU =====
const adminMenu = Markup.keyboard([
  ['📊 Statistika'],
  ['📥 Buyurtmalar'],
  ['📢 Eʼlon berish'],
  ['⬅️ Ortga']
]).resize();

// ===== ORTGA MENYU (SAVOLLAR UCHUN) =====
const backMenu = Markup.keyboard([
  ['⬅️ Ortga']
]).resize();

// ===== EXPORT =====
module.exports = {
  mainMenu,
  adminMenu,
  backMenu
};
