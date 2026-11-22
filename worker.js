// ============================================================
// FILE: worker.js
// ============================================================
const { Client } = require('discord.js-selfbot-v13');
const { Redis } = require('@upstash/redis');

// INI JUGA LO GANTI KE TOKEN REST YANG BENER
const redis = new Redis({
  url: 'https://integral-cardinal-210670.upstash.io',
  token: 'gQAAAAAAAzbuAAIgcDFhZjc5ZjM1MDQ1YTI0MWM3YjQ3OWE0MjE3ODUzYzA5Zg', 
});

const TOKEN_USER = process.env.TOKEN_USER; 
const CHANNEL_ID = process.env.CHANNEL_ID; 
const BOT_ID = process.env.BOT_ID;     

if (!TOKEN_USER || !CHANNEL_ID || !BOT_ID) {
  console.error("[x] ERROR: Secrets GitHub belum lengkap!");
  process.exit(1);
}

const client = new Client({ checkUpdate: false });
let isProcessing = false;

client.on('ready', () => {
  console.log(`[+] Worker nyala sebagai ${client.user.tag}`);
  startQueueListener();
});

client.on('messageCreate', async (msg) => {
  if (msg.author.id === client.user.id) return;
  
  if (msg.channel.id === CHANNEL_ID && msg.author.id === BOT_ID) {
    let resultLink = "";
    
    if (msg.embeds.length > 0) {
      const embed = msg.embeds[0];
      resultLink = embed.description || embed.url || embed.title || "";
      if (embed.fields && embed.fields.length > 0) resultLink = embed.fields[0].value; 
    } else {
      resultLink = msg.content;
    }

    if (resultLink) {
      resultLink = resultLink.replace(/[`*_]/g, '').trim();
      await redis.set('last_result', resultLink);
      console.log(`[+] HASIL DITEMUKAN: ${resultLink}`);
      isProcessing = false;
    }
  }
});

function startQueueListener() {
  console.log("[*] Mulai ngedengerin antrean dari Vercel...");
  
  setInterval(async () => {
    if (isProcessing) return; 

    try {
      const job = await redis.lpop('job_queue');
      
      if (job) {
        isProcessing = true;
        console.log(`[>] Request masuk: /bypass url:${job}`);
        
        try {
          const channel = await client.channels.fetch(CHANNEL_ID);
          if (!channel) throw new Error("Channel ID gak ketemu.");
          await channel.send(`/bypass url:${job}`);
          
          setTimeout(() => {
            if (isProcessing) {
              console.log(`[x] TIMEOUT: Bot gak bales untuk URL: ${job}`);
              isProcessing = false;
              redis.del('last_result'); 
            }
          }, 20000);
          
        } catch (err) {
          console.log(`[x] Gagal ngetik: ${err.message}`);
          isProcessing = false;
        }
      }
    } catch (redisError) {
      console.log(`[x] Error Redis: ${redisError.message}`);
    }
  }, 3000);
}

client.on('error', (err) => console.log(`[x] Discord Error: ${err.message}`));
process.on('unhandledRejection', (reason) => console.log(`[x] Error: ${reason}`));

client.login(TOKEN_USER).catch(err => {
  console.log(`[x] GAGAL LOGIN: ${err.message}`);
  process.exit(1);
});
