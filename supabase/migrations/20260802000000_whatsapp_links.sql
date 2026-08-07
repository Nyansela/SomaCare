-- Table for linking WhatsApp phone numbers to SomaCare user accounts
create table if not exists public.whatsapp_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  phone_number text unique,
  linking_code text unique not null,
  linked_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.whatsapp_links enable row level security;

-- Policy: Users can manage their own WhatsApp links
create policy "Users can manage their own whatsapp links" on public.whatsapp_links
  for all using (auth.uid() = user_id);

-- Policy: Service role or webhook can read/update whatsapp links (we use service role in webhook)
