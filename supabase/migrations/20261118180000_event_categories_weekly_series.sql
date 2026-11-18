alter table public.events
  add column category text not null default 'ensayos',
  add column repeat_weekly boolean not null default false,
  alter column created_by drop not null,
  add constraint events_category_check
    check (category in ('ensayos', 'novenas', 'pasacalles', 'viajes', 'presentaciones', 'cumpleanos'));

create index events_weekly_series_idx on public.events (starts_at) where repeat_weekly;

grant insert (category, repeat_weekly) on public.events to authenticated;
grant update (category, repeat_weekly) on public.events to authenticated;

-- The seeded weekly series has no human creator; it remains editable/deletable
-- by authenticated admins under the existing event policies.
insert into public.events (title, starts_at, ends_at, category, repeat_weekly)
values (
  'Ensayo',
  timestamp '2026-11-20 21:00:00' at time zone 'Europe/Madrid',
  timestamp '2026-11-20 23:00:00' at time zone 'Europe/Madrid',
  'ensayos',
  true
);
