-- Table for secure health data shares
create table if not exists public.health_shares (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  token text unique not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  revoked_at timestamp with time zone
);

alter table public.health_shares enable row level security;

-- Policy: Users can see and delete their own shares
create policy "Users can manage their own health shares" on public.health_shares
  for all using (auth.uid() = user_id);

-- Policy: Public can select ONLY based on token + not expired + not revoked
create policy "Anyone can view valid health shares" on public.health_shares
  for select using (
    revoked_at is null 
    and expires_at > now()
  );
