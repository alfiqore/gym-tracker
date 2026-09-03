require('dotenv').config();
const { Bot } = require('grammy');
const db = require('./db');
const { createTools } = require('./tools');
const { handleMessage } = require('./agent');

const token = process.env.TELEGRAM_BOT_TOKEN;
const apiKey = process.env.OPENROUTER_API_KEY;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN belum di-set di .env');
  process.exit(1);
}
if (!apiKey) {
  console.error('OPENROUTER_API_KEY belum di-set di .env');
  process.exit(1);
}

const bot = new Bot(token);
const tools = createTools(db);

const HISTORY_LIMIT = 20;

function loadHistory(chatId) {
  const rows = db.prepare(`
    SELECT role, content FROM chat_messages
    WHERE chat_id = ?
    ORDER BY id DESC LIMIT ${HISTORY_LIMIT}
  `).all(chatId).reverse();
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

function saveMessage(chatId, role, content) {
  if (!content) return;
  db.prepare(`INSERT INTO chat_messages (chat_id, role, content) VALUES (?,?,?)`).run(chatId, role, content);
}

bot.command('start', (ctx) =>
  ctx.reply(
    'Bot aktif. Kirim bebas soal makanan atau latihan, contoh:\n' +
    '"makan siang 200gr nasi + 3 telor ceplok, hitung kalorinya"\n' +
    '"latihan upper hari ini: bench press 3x8 di 50kg"\n' +
    '"bench press minggu lalu berapa kali dan sarannya gimana?"'
  )
);

bot.on('message:text', async (ctx) => {
  const userText = ctx.message.text;
  const todayIso = new Date().toISOString().slice(0, 10);
  const chatId = String(ctx.chat.id);

  await ctx.replyWithChatAction('typing');

  try {
    const history = loadHistory(chatId);
    saveMessage(chatId, 'user', userText);

    const { text, chartUrl } = await handleMessage({
      tools,
      apiKey,
      userText,
      todayIso,
      history
    });

    if (text) {
      saveMessage(chatId, 'assistant', text);
      await ctx.reply(text);
    }
    if (chartUrl) await ctx.replyWithPhoto(chartUrl);
  } catch (err) {
    console.error('Error handling message:', err);
    await ctx.reply('Ada error pas proses pesan ini. Coba lagi, atau cek log di terminal.');
  }
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

bot.start();
console.log('Bot jalan pakai long polling...');