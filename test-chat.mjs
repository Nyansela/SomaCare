import fs from 'fs';
import server from './.output/server/index.mjs';

// Simple .env parser
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  });
}

async function test() {
  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
      threadId: 'test-thread'
    })
  });
  const env = {
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const ctx = {
    waitUntil: (p) => p.catch(console.error),
    passThroughOnException: () => {}
  };
  const res = await server.fetch(req, env, ctx);
  console.log('STATUS:', res.status);
  console.log('HEADERS:', Object.fromEntries(res.headers.entries()));
  const text = await res.text();
  console.log('BODY:', text);
}

test().catch(console.error);
