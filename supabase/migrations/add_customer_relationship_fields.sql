alter table public.customers add column if not exists balance numeric(10,2) default 0;
alter table public.customers add column if not exists satisfaction text
  check (satisfaction in ('like', 'dislike') or satisfaction is null);
alter table public.customers add column if not exists notes_private text;
