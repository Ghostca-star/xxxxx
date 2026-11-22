// ============================================================
// 3. worker.js (Jalan di GitHub Actions)
// ============================================================
const { Client } = require('discord.js-selfbot-v13');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: 'https://integral-cardinal-210670.upstash.io',
  token: 'gQAAAAAAAzbuAAIgcDHO6BGx65qFwgIyjzlZolB4gAVPvXmiyZIGB1k4L4jV0w',
});

const TOKEN_USER = process.env.TOKEN_USER; 
const CHANNEL_ID = process.env.CHANNEL_ID; 
const BOT_ID = process.env.BOT_ID;     

const client = new Client({ checkUpdate: false });

client.on('ready', () => {
  console.log(`[+] Worker nyala sebagai ${client.user.tag}`);
});

client.on('messageCreate', async (msg) => {
  if (msg.channel.id === CHANNEL_ID && msg.author.id === BOT_ID) {
    let resultLink = msg.content;
    if (msg.embeds.length > 0) {
      resultLink = msg.embeds[0].description || msg.embeds[0].url || msg.content;
    }
    await redis.set('last_result', resultLink);
    console.log(`[+] Hasil masuk ke Redis: ${resultLink}`);
  }
});

async function listenQueue() {
  setInterval(async () => {
    const job = await redis.lpop('job_queue');
    if (job) {
      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await channel.send(`/bypass url:${job}`);
        console.log(`[>] Eksekusi: /bypass url:${job}`);
      } catch (err) {
        console.log(`[x] Gagal kirim: ${err.message}`);
      }
    }
  }, 2000);
}

client.on('ready', listenQueue);
client.login(TOKEN_USER);
