// ============================================================
// FILE: worker.js (PURE EXTRACTOR - NO BLACKLIST)
// ============================================================
const { Client } = require('discord.js-selfbot-v13');
const { Redis } = require('@upstash/redis');

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
let currentTarget = ""; 

client.on('ready', () => {
  console.log(`[+] Worker nyala sebagai ${client.user.tag}`);
  startQueueListener();
});

client.on('messageCreate', async (msg) => {
  if (msg.author.id === client.user.id) return;
  
  if (msg.channel.id === CHANNEL_ID && msg.author.id === BOT_ID) {
    
    // Abaikan pesan list support
    if (msg.content && msg.content.includes("Supported Links")) return;

    let fullText = msg.content || "";
    
    if (msg.embeds.length > 0) {
      const embed = msg.embeds[0];
      if (embed.description) fullText += "\n" + embed.description;
      if (embed.fields && embed.fields.length > 0) {
        for (const field of embed.fields) {
          fullText += "\n" + field.value;
        }
      }
    }

    // Regex nyedot semua link, berhenti di spasi/backtick/bintang
    const urlRegex = /(https?:\/\/[^\s`*<>]+)/g;
    const foundLinks = fullText.match(urlRegex) || [];

    for (let link of foundLinks) {
      // Bersihin ujung link dari karakter markdown
      link = link.replace(/[`*_<>\]\[\(\)]+$/g, '').trim(); 

      // Kalo link ini BUKAN link yang lo tembak, SEDOT!
      if (link !== currentTarget) {
        await redis.set('last_result', link);
        console.log(`[+] HASIL BYPASS DAPET: ${link}`);
        isProcessing = false;
        return; // Langsung stop biar gak overwrite
      }
    }
  }
});

function startQueueListener() {
  console.log("[*] Mulai ngedengerin antrean...");
  
  setInterval(async () => {
    if (isProcessing) return; 

    try {
      const job = await redis.lpop('job_queue');
      
      if (job) {
        isProcessing = true;
        currentTarget = job;
        console.log(`[>] Request masuk: /bypass url:${job}`);
        
        try {
          const channel = await client.channels.fetch(CHANNEL_ID);
          await channel.send(`/bypass url:${job}`);
          
          setTimeout(() => {
            if (isProcessing) {
              console.log(`[x] TIMEOUT: Bot gak ngasih link bypass dalam 30 detik.`);
              isProcessing = false;
              redis.del('last_result'); 
            }
          }, 30000);
          
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
