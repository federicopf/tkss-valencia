alter table public.events
  add column all_day boolean not null default false;

create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 5000),
  location text check (location is null or char_length(location) <= 200),
  images text[] not null default '{}',
  category text not null default 'ensayos'
    check (category in ('ensayos', 'novenas', 'pasacalles', 'viajes', 'presentaciones', 'cumpleanos')),
  frequency text not null check (frequency in ('weekly', 'yearly')),
  starts_on date not null,
  local_start_time time,
  local_end_time time,
  all_day boolean not null default false,
  until_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_series_end_after_start check (until_date is null or until_date >= starts_on),
  constraint event_series_time_shape check (
    (all_day and local_start_time is null and local_end_time is null)
    or (not all_day and local_start_time is not null and local_end_time is not null and local_start_time <> local_end_time)
  ),
  constraint valid_event_series_images check (public.valid_event_image_paths(images))
);

create index event_series_start_idx on public.event_series (starts_on, until_date);

create table public.event_occurrences (
  series_id uuid not null references public.event_series(id) on delete cascade,
  occurrence_date date not null,
  cancelled boolean not null default false,
  overrides jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (series_id, occurrence_date),
  constraint event_occurrence_overrides_object check (jsonb_typeof(overrides) = 'object'),
  constraint event_occurrence_override_keys check (
    overrides - array['title', 'description', 'location', 'images', 'category', 'starts_at', 'ends_at', 'all_day'] = '{}'::jsonb
  ),
  constraint event_occurrence_cancel_shape check (not cancelled or overrides = '{}'::jsonb)
);

create index event_occurrences_date_idx on public.event_occurrences (occurrence_date);

create function public.set_recurring_event_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_event_series_updated_at before update on public.event_series
for each row execute function public.set_recurring_event_updated_at();
create trigger set_event_occurrence_updated_at before update on public.event_occurrences
for each row execute function public.set_recurring_event_updated_at();

create function public.audit_recurring_event_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  audit_id uuid;
  audit_before jsonb;
  audit_after jsonb;
begin
  if tg_table_name = 'event_series' then
    audit_id := coalesce(new.id, old.id);
    audit_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
    audit_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  else
    audit_id := coalesce(new.series_id, old.series_id);
    audit_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
    audit_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  end if;
  insert into public.admin_audit_log (event_id, actor_id, operation, before_data, after_data)
  values (audit_id, auth.uid(), tg_op, audit_before, audit_after);
  return coalesce(new, old);
end;
$$;

create trigger audit_event_series_change after insert or update or delete on public.event_series
for each row execute function public.audit_recurring_event_change();
create trigger audit_event_occurrence_change after insert or update or delete on public.event_occurrences
for each row execute function public.audit_recurring_event_change();

alter table public.event_series enable row level security;
alter table public.event_occurrences enable row level security;
revoke all on public.event_series, public.event_occurrences from anon, authenticated;
grant select on public.event_series, public.event_occurrences to anon, authenticated;
grant insert (title, description, location, images, category, frequency, starts_on, local_start_time, local_end_time, all_day, until_date, created_by)
  on public.event_series to authenticated;
grant update (title, description, location, images, category, frequency, starts_on, local_start_time, local_end_time, all_day, until_date)
  on public.event_series to authenticated;
grant delete on public.event_series to authenticated;
grant insert (series_id, occurrence_date, cancelled, overrides, created_by)
  on public.event_occurrences to authenticated;
grant update (cancelled, overrides) on public.event_occurrences to authenticated;
grant delete on public.event_occurrences to authenticated;

create policy "Public can read event series" on public.event_series
  for select to anon, authenticated using (true);
create policy "Admins can create event series" on public.event_series
  for insert to authenticated with check (auth.uid() is not null and created_by = auth.uid());
create policy "Admins can update event series" on public.event_series
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Admins can delete event series" on public.event_series
  for delete to authenticated using (auth.uid() is not null);

create policy "Public can read event occurrences" on public.event_occurrences
  for select to anon, authenticated using (true);
create policy "Admins can create event occurrences" on public.event_occurrences
  for insert to authenticated with check (auth.uid() is not null and created_by = auth.uid());
create policy "Admins can update event occurrences" on public.event_occurrences
  for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Admins can delete event occurrences" on public.event_occurrences
  for delete to authenticated using (auth.uid() is not null);

-- Move the existing Friday schedule into the generalized series table.
-- Keep the legacy row and repeat_weekly flag temporarily for old frontend builds.
insert into public.event_series (
  id, title, description, location, images, category, frequency, starts_on,
  local_start_time, local_end_time, all_day, until_date, created_by, created_at, updated_at
)
select
  id, title, description, location, images, category, 'weekly',
  (starts_at at time zone 'Europe/Madrid')::date,
  (starts_at at time zone 'Europe/Madrid')::time,
  (ends_at at time zone 'Europe/Madrid')::time,
  false, null, created_by, created_at, updated_at
from public.events
where repeat_weekly
on conflict (id) do nothing;

