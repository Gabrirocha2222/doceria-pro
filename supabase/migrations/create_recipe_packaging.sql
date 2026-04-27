create table if not exists public.recipe_packaging (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  packaging_id uuid not null references public.packaging(id) on delete cascade,
  quantity_per_recipe_unit numeric(10,4),
  usage_type text not null default 'unitaria' check (usage_type in ('unitaria', 'transporte')),
  notes text,
  created_at timestamptz default now()
);

alter table public.recipe_packaging enable row level security;

drop policy if exists "Users can view their own recipe_packaging" on public.recipe_packaging;
create policy "Users can view their own recipe_packaging"
on public.recipe_packaging
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own recipe_packaging" on public.recipe_packaging;
create policy "Users can insert their own recipe_packaging"
on public.recipe_packaging
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own recipe_packaging" on public.recipe_packaging;
create policy "Users can update their own recipe_packaging"
on public.recipe_packaging
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own recipe_packaging" on public.recipe_packaging;
create policy "Users can delete their own recipe_packaging"
on public.recipe_packaging
for delete
using (auth.uid() = user_id);

create index if not exists recipe_packaging_user_id_idx
on public.recipe_packaging(user_id);

create index if not exists recipe_packaging_recipe_id_idx
on public.recipe_packaging(recipe_id);

create index if not exists recipe_packaging_packaging_id_idx
on public.recipe_packaging(packaging_id);