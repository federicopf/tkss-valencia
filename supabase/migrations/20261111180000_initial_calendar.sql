-- Calendar data is public. Only signed-in accounts may change it.
-- Public sign-up must also be disabled in Supabase Auth configuration.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 5000),
  location text check (location is null or char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_ends_after_start check (ends_at > starts_at)
);

create index events_date_range_idx on public.events (starts_at, ends_at);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  actor_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);

create index admin_audit_log_event_idx on public.admin_audit_log (event_id, occurred_at desc);
create index admin_audit_log_actor_idx on public.admin_audit_log (actor_id, occurred_at desc);

create function public.set_event_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_event_updated_at
before update on public.events
for each row execute function public.set_event_updated_at();

create function public.audit_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_audit_log (event_id, actor_id, operation, before_data, after_data)
  values (
    coalesce(new.id, old.id),
    auth.uid(),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_event_change
after insert or update or delete on public.events
for each row execute function public.audit_event_change();

alter table public.events enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on public.events from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert (title, description, location, starts_at, ends_at, created_by) on public.events to authenticated;
grant update (title, description, location, starts_at, ends_at) on public.events to authenticated;
grant delete on public.events to authenticated;

create policy "Public can read events"
on public.events for select to anon, authenticated
using (true);

create policy "Admins can create events"
on public.events for insert to authenticated
with check (auth.uid() is not null and created_by = auth.uid());

create policy "Admins can update events"
on public.events for update to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "Admins can delete events"
on public.events for delete to authenticated
using (auth.uid() is not null);

-- No client-facing policy or grant exists for the audit table. The trigger
-- writes to it under its owner; admins can inspect it in Supabase Studio.
