// ============================================================
// FILE: worker.js
// Jalan di GitHub Actions.
// Pastiin lo udah isi Secrets di GitHub (TOKEN_USER, CHANNEL_ID, BOT_ID)
// ============================================================
const { Client } = require('discord.js-selfbot-v13');
const { Redis } = require('@upstash/redis');

// Koneksi ke database antrean Upstash (Udah sesuai punya lo)
const redis = new Redis({
  url: 'https://integral-cardinal-210670.upstash.io',
  token: 'gQAAAAAAAzbuAAIgcDHO6BGx65qFwgIyjzlZolB4gAVPvXmiyZIGB1k4L4jV0w',
});

// Ambil config dari Environment Variable GitHub
const TOKEN_USER = process.env.TOKEN_USER; 
const CHANNEL_ID = process.env.CHANNEL_ID; 
const BOT_ID = process.env.BOT_ID;     

if (!TOKEN_USER || !CHANNEL_ID || !BOT_ID) {
  console.error("[x] ERROR: Secrets GitHub belum lengkap! Cek TOKEN_USER, CHANNEL_ID, BOT_ID.");
  process.exit(1);
}

const client = new Client({ checkUpdate: false });
let isProcessing = false;

client.on('ready', () => {
  console.log(`[+] Worker nyala sebagai ${client.user.tag}`);
  startQueueListener();
});

// ============================================================
// 1. NANGKEP BALASAN DARI BOT BACON
// ============================================================
client.on('messageCreate', async (msg) => {
  // Abaikan pesan dari akun lo sendiri
  if (msg.author.id === client.user.id) return;
  
  // Cek apakah pesan dari bot target di channel target
  if (msg.channel.id === CHANNEL_ID && msg.author.id === BOT_ID) {
    let resultLink = "";
    
    // Prioritas 1: Ambil dari embed (kalo botnya bales pake embed)
    if (msg.embeds.length > 0) {
      const embed = msg.embeds[0];
      resultLink = embed.description || embed.url || embed.title || "";
      
      if (embed.fields && embed.fields.length > 0) {
        resultLink = embed.fields[0].value; 
      }
    } 
    // Prioritas 2: Ambil dari text biasa (kalo botnya bales teks)
    else {
      resultLink = msg.content;
    }

    // Bersihin format markdown
    if (resultLink) {
      resultLink = resultLink.replace(/[`*_]/g, '').trim();
      
      // Simpan ke Redis
      await redis.set('last_result', resultLink);
      console.log(`[+] HASIL DITEMUKAN & DISIMPAN KE REDIS: ${resultLink}`);
      
      // Set status selesai
      isProcessing = false;
    }
  }
});

// ============================================================
// 2. DENGERIN ANTREAN DARI VERCEL (REDIS)
// ============================================================
function startQueueListener() {
  console.log("[*] Mulai ngedengerin antrean dari Vercel...");
  
  setInterval(async () => {
    // Kalo masih nunggu bot bales, jangan kirim command baru dulu
    if (isProcessing) return; 

    try {
      const job = await redis.lpop('job_queue');
      
      if (job) {
        isProcessing = true;
        console.log(`[>] Request masuk. Ngirim command ke DC: /bypass url:${job}`);
        
        try {
          const channel = await client.channels.fetch(CHANNEL_ID);
          if (!channel) throw new Error("Channel ID gak ketemu / bot gak punya akses.");
          
          // Kirim perintah
          await channel.send(`/bypass url:${job}`);
          
          // Kasih waktu bot maksimal 20 detik buat mikir & bales
          setTimeout(() => {
            if (isProcessing) {
              console.log(`[x] TIMEOUT: Bot Bacon gak bales dalam 20 detik untuk URL: ${job}`);
              isProcessing = false;
              redis.del('last_result'); 
            }
          }, 20000);
          
        } catch (err) {
          console.log(`[x] Gagal ngetik di channel: ${err.message}`);
          isProcessing = false;
        }
      }
    } catch (redisError) {
      console.log(`[x] Error koneksi Redis: ${redisError.message}`);
    }
  }, 3000); // Cek antrean tiap 3 detik
}

// ============================================================
// 3. HANDLE ERROR & MATI
// ============================================================
client.on('error', (err) => {
  console.log(`[x] Discord Error: ${err.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(`[x] Unhandled Rejection: ${reason}`);
});

// Login pake token akun lo
client.login(TOKEN_USER).catch(err => {
  console.log(`[x] GAGAL LOGIN: ${err.message}`);
  console.log("[!] Cek token akun lo di GitHub Secrets, mungkin udah expired atau kena reset.");
  process.exit(1);
});
