require('dotenv').config();

const ADMIN_ID = '1041434250';

function must(key) {
  const val = process.env[key];
  if (!val) {
    console.error(`❌ ENV yo'q: ${key}`);
  }
  return val;
}

module.exports = {
  BOT_TOKEN: must('BOT_TOKEN'),
  ADMIN_ID: ADMIN_ID,
};
