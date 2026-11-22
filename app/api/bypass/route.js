// ============================================================
// 2. app/api/bypass/route.js (Endpoint API Vercel)
// ============================================================
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const redis = new Redis({
  url: 'https://integral-cardinal-210670.upstash.io',
  token: 'gQAAAAAAAzbuAAIgcDHO6BGx65qFwgIyjzlZolB4gAVPvXmiyZIGB1k4L4jV0w',
});

// Handler buat terima POST (kalo mau support GET juga, tinggal tambahin)
export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL kosong' }, { status: 400 });

    await redis.del('last_result');
    await redis.rpush('job_queue', url);

    let result = null;
    let attempts = 0;
    
    // Polling maks 30 detik (15 x 2 detik)
    while (attempts < 15) {
      await new Promise(r => setTimeout(r, 2000));
      result = await redis.get('last_result');
      if (result) break;
      attempts++;
    }

    if (!result) return NextResponse.json({ error: 'Timeout nunggu worker' }, { status: 504 });
    
    return NextResponse.json({ success: true, url: url, result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Opsional: Handle OPTIONS buat CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
