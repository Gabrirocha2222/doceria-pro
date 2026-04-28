create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text,
  owner_name text,
  whatsapp text,
  instagram text,
  address text,
  city text,
  state text,
  primary_color text default '#C0392B',
  accent_color text default '#C9A84C',
  background_color text default '#FAF6F0',
  text_color text default '#1A0A08',
  default_order_status text default 'pendente',
  require_delivery_date boolean default false,
  default_down_payment_percent numeric(5,2) default 0,
  purchase_list_default_mode text default 'semana',
  production_alert_days integer default 2,
  supplier_alert_days integer default 2,
  remarketing_alert_days integer default 14,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "Users can view their own app settings" on public.app_settings;
create policy "Users can view their own app settings"
on public.app_settings
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own app settings" on public.app_settings;
create policy "Users can insert their own app settings"
on public.app_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own app settings" on public.app_settings;
create policy "Users can update their own app settings"
on public.app_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own app settings" on public.app_settings;
create policy "Users can delete their own app settings"
on public.app_settings
for delete
using (auth.uid() = user_id);

create index if not exists app_settings_user_id_idx
on public.app_settings(user_id);

create table if not exists public.app_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  name text not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.app_categories enable row level security;

drop policy if exists "Users can view their own app categories" on public.app_categories;
create policy "Users can view their own app categories"
on public.app_categories
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own app categories" on public.app_categories;
create policy "Users can insert their own app categories"
on public.app_categories
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own app categories" on public.app_categories;
create policy "Users can update their own app categories"
on public.app_categories
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own app categories" on public.app_categories;
create policy "Users can delete their own app categories"
on public.app_categories
for delete
using (auth.uid() = user_id);

create index if not exists app_categories_user_id_idx
on public.app_categories(user_id);

create index if not exists app_categories_type_idx
on public.app_categories(type);
