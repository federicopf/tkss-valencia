-- Image files live under public/events in the Git repository and are
-- published as static assets. The database stores stable, root-relative paths.

create function public.valid_event_image_paths(paths text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(paths) <= 12
    and coalesce(bool_and(path is not null and path ~ '^/events/[A-Za-z0-9][A-Za-z0-9/_-]*\.(jpg|jpeg|png|webp|avif)$'), true)
  from unnest(paths) as image_path(path);
$$;

alter table public.events
  add column images text[] not null default '{}'
  constraint valid_event_images check (public.valid_event_image_paths(images));

grant insert (images) on public.events to authenticated;
grant update (images) on public.events to authenticated;
