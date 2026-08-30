import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

if (fs.existsSync('.dev.vars')) {
  const envContent = fs.readFileSync('.dev.vars', 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  });
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const email = `test_${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  const { data, error } = await supabase.auth.signUp({ email, password });
  console.log('Signup result:', { user: data?.user?.id, session: !!data?.session, error });
  let token = data?.session?.access_token;
  let userId = data?.user?.id;

  if (!token) {
    const signIn = await supabase.auth.signInWithPassword({ email: 'test@example.com', password: 'Password123!' });
    console.log('Signin result:', { user: signIn.data?.user?.id, session: !!signIn.data?.session, error: signIn.error });
    token = signIn.data?.session?.access_token;
    userId = signIn.data?.user?.id;
  }

  if (!token || !userId) {
    console.error('Failed to get auth token.');
    return;
  }

  console.log('Got valid auth token for user:', userId);

  // Create thread
  const { data: thread, error: threadErr } = await supabase.from('ai_threads').insert({
    user_id: userId,
    title: 'New conversation'
  }).select('id').single();

  if (threadErr || !thread) {
    console.error('Thread creation error:', threadErr);
    return;
  }

  console.log('Thread created:', thread.id);

  // Start wrangler dev in background or test fetch
  console.log('Sending HTTP POST to http://127.0.0.1:8787/api/chat...');
  const res = await fetch('http://127.0.0.1:8787/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello Adwoa! Please create a 3-day workout plan for weight loss.' }] }],
      threadId: thread.id
    })
  });

  console.log('HTTP Status:', res.status);
  console.log('HTTP Headers:', Object.fromEntries(res.headers.entries()));
  const bodyText = await res.text();
  console.log('HTTP Response Body:\n', bodyText);
}

run().catch(console.error);
