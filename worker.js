// ============================================================
// FILE: worker.js (FINAL FIX - Bacon Bypass Extractor)
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
  
  // Filter: Cuma respon pesan dari Bot ID di Channel ID target
  if (msg.channel.id === CHANNEL_ID && msg.author.id === BOT_ID) {
    let resultLink = "";

    // BACA DARI EMBED
    if (msg.embeds.length > 0) {
      const embed = msg.embeds[0];
      
      // Cari field yang namanya "Mobile Copy" atau "PC Copy"
      if (embed.fields && embed.fields.length > 0) {
        for (const field of embed.fields) {
          if (field.name.toLowerCase().includes("mobile copy") || field.name.toLowerCase().includes("pc copy")) {
            resultLink = field.value; // Ambil isi fieldnya (link mediafire)
            break; // Langsung stop kalo udah nemu
          }
        }
      }
      
      // Fallback: Kalo ternyata bot ngirim link di description
      if (!resultLink && embed.description) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = embed.description.match(urlRegex);
        if (match) resultLink = match[0];
      }
    } 
    
    // Fallback: Kalo bot ngirim teks biasa
    if (!resultLink && msg.content) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const match = msg.content.match(urlRegex);
      if (match) resultLink = match[0];
    }

    // Bersihin format markdown (` atau * atau <>)
    if (resultLink) {
      resultLink = resultLink.replace(/[`*_<>]/g, '').trim();
      
      // Validasi: Jangan simpen link linkvertise atau link asli masuk
      if (resultLink !== currentTarget && !resultLink.includes("linkvertise.com")) {
        await redis.set('last_result', resultLink);
        console.log(`[+] HASIL BYPASS DAPET: ${resultLink}`);
        isProcessing = false;
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
          if (!channel) throw new Error("Channel ID gak ketemu.");
          
          await channel.send(`/bypass url:${job}`);
          
          // Timeout dinaikin jadi 30 detik buat nunggu bot proses
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
