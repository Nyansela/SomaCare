-- Create voice_cache table
create table if not exists public.voice_cache (
  id uuid primary key default gen_random_uuid(),
  text_hash text not null,
  language text not null,
  audio_url text not null,
  created_at timestamptz default now()
);

create index if not exists idx_voice_cache_hash_lang on public.voice_cache (text_hash, language);

-- Enable RLS on voice_cache
alter table public.voice_cache enable row level security;

-- Allow public / authenticated read and insert for backend service / api route
drop policy if exists "Allow read/insert voice_cache" on public.voice_cache;
create policy "Allow read/insert voice_cache" on public.voice_cache
  for all using (true) with check (true);

-- Create storage bucket for voice cache if not exists
insert into storage.buckets (id, name, public)
values ('voice-cache', 'voice-cache', true)
on conflict (id) do nothing;

-- Storage object policies (idempotent: recreate if they already exist)
drop policy if exists "Public Access voice-cache" on storage.objects;
drop policy if exists "Insert Access voice-cache" on storage.objects;

create policy "Public Access voice-cache" on storage.objects
  for select using (bucket_id = 'voice-cache');

create policy "Insert Access voice-cache" on storage.objects
  for insert with check (bucket_id = 'voice-cache');
