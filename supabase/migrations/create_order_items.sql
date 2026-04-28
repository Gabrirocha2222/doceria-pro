create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  parent_order_item_id uuid references public.order_items(id) on delete cascade,
  item_name text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  flavor_details jsonb,
  notes text,
  created_at timestamptz default now()
);

alter table public.order_items enable row level security;

drop policy if exists "Users can view their own order items" on public.order_items;
create policy "Users can view their own order items"
on public.order_items
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own order items" on public.order_items;
create policy "Users can insert their own order items"
on public.order_items
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own order items" on public.order_items;
create policy "Users can update their own order items"
on public.order_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own order items" on public.order_items;
create policy "Users can delete their own order items"
on public.order_items
for delete
using (auth.uid() = user_id);

create index if not exists order_items_user_id_idx
on public.order_items(user_id);

create index if not exists order_items_order_id_idx
on public.order_items(order_id);

create index if not exists order_items_recipe_id_idx
on public.order_items(recipe_id);

create index if not exists order_items_parent_order_item_id_idx
on public.order_items(parent_order_item_id);
