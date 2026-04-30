create table if not exists public.kit_flexible_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kit_recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  total_quantity numeric(10,2) not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.kit_flexible_groups enable row level security;

drop policy if exists "Users can view their own kit flexible groups" on public.kit_flexible_groups;
create policy "Users can view their own kit flexible groups"
on public.kit_flexible_groups
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own kit flexible groups" on public.kit_flexible_groups;
create policy "Users can insert their own kit flexible groups"
on public.kit_flexible_groups
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own kit flexible groups" on public.kit_flexible_groups;
create policy "Users can update their own kit flexible groups"
on public.kit_flexible_groups
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own kit flexible groups" on public.kit_flexible_groups;
create policy "Users can delete their own kit flexible groups"
on public.kit_flexible_groups
for delete
using (auth.uid() = user_id);

create index if not exists kit_flexible_groups_user_id_idx
on public.kit_flexible_groups(user_id);

create index if not exists kit_flexible_groups_kit_recipe_id_idx
on public.kit_flexible_groups(kit_recipe_id);

create table if not exists public.kit_flexible_group_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flexible_group_id uuid not null references public.kit_flexible_groups(id) on delete cascade,
  category text not null,
  default_quantity numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table public.kit_flexible_group_categories enable row level security;

drop policy if exists "Users can view their own kit flexible group categories" on public.kit_flexible_group_categories;
create policy "Users can view their own kit flexible group categories"
on public.kit_flexible_group_categories
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own kit flexible group categories" on public.kit_flexible_group_categories;
create policy "Users can insert their own kit flexible group categories"
on public.kit_flexible_group_categories
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own kit flexible group categories" on public.kit_flexible_group_categories;
create policy "Users can update their own kit flexible group categories"
on public.kit_flexible_group_categories
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own kit flexible group categories" on public.kit_flexible_group_categories;
create policy "Users can delete their own kit flexible group categories"
on public.kit_flexible_group_categories
for delete
using (auth.uid() = user_id);

create index if not exists kit_flexible_group_categories_user_id_idx
on public.kit_flexible_group_categories(user_id);

create index if not exists kit_flexible_group_categories_flexible_group_id_idx
on public.kit_flexible_group_categories(flexible_group_id);

create index if not exists kit_flexible_group_categories_category_idx
on public.kit_flexible_group_categories(category);
