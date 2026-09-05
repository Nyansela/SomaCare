-- AI usage limits + one-time welcome upgrade page.
--
-- 1. profiles gains AI usage counters for the free-tier assistant limit and a
--    welcome_seen flag so NEW users are shown the subscription page exactly
--    once after joining (existing rows default to true and are never nagged).
-- 2. consume_ai_usage() atomically rolls the 30-day period over, increments the
--    user's counter and reports whether the free limit is exceeded. It is the
--    ONLY writer to these columns, so counting cannot be double-incremented or
--    reset inconsistently, and it is security definer so the chat API can call
--    it with the user's own token (RLS on profiles does not apply inside).

alter table public.profiles
  add column if not exists ai_requests_used integer not null default 0;

alter table public.profiles
  add column if not exists ai_requests_period_start timestamptz;

-- True once the user has seen the upgrade page (set on first redirect).
-- Defaults to true for existing accounts - only NEW signups are redirected.
alter table public.profiles
  add column if not exists welcome_seen boolean not null default true;

-- Free tier allowance: AI assistant messages per 30-day rolling period.
create or replace function public.consume_ai_usage(p_user_id uuid)
returns table (
  used int,
  monthly_limit int,
  over_limit boolean,
  period_start timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_tier text;
  v_bypass boolean;
  v_used int;
  v_period timestamptz;
  v_limit int;
  v_free_limit constant int := 20;
begin
  -- Only the signed-in user may consume their own usage.
  if p_user_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  select subscription_tier, bypass_paywall, ai_requests_used, ai_requests_period_start
    into v_tier, v_bypass, v_used, v_period
    from public.profiles
   where id = p_user_id
     for update;

  if not found then
    return query select 0, null::int, false, now();
    return;
  end if;

  -- Roll the period over after 30 days.
  if v_period is null or v_period < now() - interval '30 days' then
    v_used := 0;
    v_period := now();
  end if;

  -- Paid (or bypass) accounts are unlimited; free accounts get v_free_limit.
  v_limit := case
    when v_bypass then null
    when v_tier = 'free' or v_tier is null then v_free_limit
    else null
  end;

  v_used := v_used + 1;

  update public.profiles
     set ai_requests_used = v_used,
         ai_requests_period_start = v_period
   where id = p_user_id;

  return query select v_used, v_limit, (v_limit is not null and v_used > v_limit), v_period;
end $$;

revoke execute on function public.consume_ai_usage(uuid) from public, anon;
grant execute on function public.consume_ai_usage(uuid) to authenticated, service_role;

-- New signups get welcome_seen = false so their first visit lands on the
-- subscription page. Existing rows keep the default (true) - no mass nagging.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, welcome_seen)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          false)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;
  insert into public.health_vault (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();