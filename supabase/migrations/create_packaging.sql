create table if not exists public.packaging (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  package_quantity numeric(10,2) not null,
  unit text not null,
  package_cost numeric(10,2) not null,
  cost_per_unit numeric(10,4) not null,
  capacity numeric(10,2),
  capacity_unit text,
  notes text,
  created_at timestamptz default now()
);

alter table public.packaging enable row level security;

drop policy if exists "Users can view their own packaging" on public.packaging;
create policy "Users can view their own packaging"
on public.packaging
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own packaging" on public.packaging;
create policy "Users can insert their own packaging"
on public.packaging
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own packaging" on public.packaging;
create policy "Users can update their own packaging"
on public.packaging
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own packaging" on public.packaging;
create policy "Users can delete their own packaging"
on public.packaging
for delete
using (auth.uid() = user_id);

create index if not exists packaging_user_id_idx
on public.packaging(user_id);

create index if not exists packaging_name_idx
on public.packaging(name);
