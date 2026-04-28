create table if not exists public.kit_category_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kit_recipe_id uuid not null references public.recipes(id) on delete cascade,
  category text not null,
  quantity numeric(10,2) not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.kit_category_components enable row level security;

drop policy if exists "Users can view their own kit category components" on public.kit_category_components;
create policy "Users can view their own kit category components"
on public.kit_category_components
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own kit category components" on public.kit_category_components;
create policy "Users can insert their own kit category components"
on public.kit_category_components
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own kit category components" on public.kit_category_components;
create policy "Users can update their own kit category components"
on public.kit_category_components
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own kit category components" on public.kit_category_components;
create policy "Users can delete their own kit category components"
on public.kit_category_components
for delete
using (auth.uid() = user_id);

create index if not exists kit_category_components_user_id_idx
on public.kit_category_components(user_id);

create index if not exists kit_category_components_kit_recipe_id_idx
on public.kit_category_components(kit_recipe_id);
