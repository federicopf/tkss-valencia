insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 8388608, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view event images" on storage.objects for select to anon, authenticated
using (bucket_id = 'event-images');
create policy "Admins can upload event images" on storage.objects for insert to authenticated
with check (bucket_id = 'event-images');
create policy "Admins can update event images" on storage.objects for update to authenticated
using (bucket_id = 'event-images') with check (bucket_id = 'event-images');
create policy "Admins can delete event images" on storage.objects for delete to authenticated
using (bucket_id = 'event-images');

alter table public.events drop constraint valid_event_images;
create or replace function public.valid_event_image_paths(paths text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(paths) <= 12
    and coalesce(bool_and(path is not null and path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]+\\.(jpg|jpeg|png|webp|avif)$'), true)
  from unnest(paths) as image_path(path);
$$;
alter table public.events add constraint valid_event_images check (public.valid_event_image_paths(images));
