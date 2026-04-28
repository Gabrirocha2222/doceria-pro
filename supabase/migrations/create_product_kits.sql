alter table public.recipes
add column if not exists product_type text not null default 'simples'
check (product_type in ('simples', 'kit'));

alter table public.recipes
add column if not exists is_third_party boolean not null default false;

alter table public.recipes
add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create table if not exists public.product_kit_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kit_recipe_id uuid not null references public.recipes(id) on delete cascade,
  item_recipe_id uuid not null references public.recipes(id) on delete restrict,
  quantity numeric(10,2) not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.product_kit_items enable row level security;

drop policy if exists "Users can view their own product kit items" on public.product_kit_items;
create policy "Users can view their own product kit items"
on public.product_kit_items
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own product kit items" on public.product_kit_items;
create policy "Users can insert their own product kit items"
on public.product_kit_items
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own product kit items" on public.product_kit_items;
create policy "Users can update their own product kit items"
on public.product_kit_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own product kit items" on public.product_kit_items;
create policy "Users can delete their own product kit items"
on public.product_kit_items
for delete
using (auth.uid() = user_id);

create index if not exists product_kit_items_user_id_idx
on public.product_kit_items(user_id);

create index if not exists product_kit_items_kit_recipe_id_idx
on public.product_kit_items(kit_recipe_id);

create index if not exists product_kit_items_item_recipe_id_idx
on public.product_kit_items(item_recipe_id);
