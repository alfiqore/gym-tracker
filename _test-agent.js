require('dotenv').config();
const { handleMessage } = require('D:/projects/gym-food-tracker/agent');
const { createTools } = require('D:/projects/gym-food-tracker/tools');
const db = require('D:/projects/gym-food-tracker/db');
const tools = createTools(db);

(async () => {
  const r = await handleMessage({
    tools,
    apiKey: process.env.OPENROUTER_API_KEY,
    userText: 'total kalori hari ini berapa?',
    todayIso: new Date().toISOString().slice(0, 10),
    model: 'openai/gpt-4o-mini'
  });
  console.log(JSON.stringify(r).slice(0, 800));
})().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
