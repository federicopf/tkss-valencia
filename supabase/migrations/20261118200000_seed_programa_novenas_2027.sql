-- The supplied program does not specify times or locations; these entries are
-- therefore stored as Valencia-local full-day events with no location.
insert into public.events (title, starts_at, ends_at, category, all_day)
values
  ('Novena — Caporales San Simón Cochabamba', timestamp '2026-11-06 00:00:00' at time zone 'Europe/Madrid', timestamp '2026-11-07 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Novena — Salay Bolivia · Tradiciones Cochabambinas', timestamp '2026-12-04 00:00:00' at time zone 'Europe/Madrid', timestamp '2026-12-05 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Novena — Tinkus Tiataco USA filial Valencia', timestamp '2027-01-08 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-01-09 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Novena — Fraternidad por confirmar', timestamp '2027-02-05 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-02-06 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Novena — Morenada Verdaderos Intocables filial Valencia', timestamp '2027-03-05 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-03-06 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Novena — Tinkus Kaysur Filial Valencia', timestamp '2027-04-02 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-04-03 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Kermés', timestamp '2027-04-03 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-04-04 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Novena — Tinkus San Simón filial Valencia', timestamp '2027-05-07 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-05-08 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Kermés', timestamp '2027-05-08 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-05-09 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Novena — Caporales San Simón Oruro', timestamp '2027-06-04 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-06-05 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Kermés', timestamp '2027-06-05 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-06-06 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Novena — Fraternidad por confirmar', timestamp '2027-07-02 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-07-03 00:00:00' at time zone 'Europe/Madrid', 'novenas', true),
  ('Convite', timestamp '2027-08-08 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-08-09 00:00:00' at time zone 'Europe/Madrid', 'pasacalles', true),
  ('Pasacalle y fiesta de la Virgen', timestamp '2027-08-14 00:00:00' at time zone 'Europe/Madrid', timestamp '2027-08-15 00:00:00' at time zone 'Europe/Madrid', 'pasacalles', true);
