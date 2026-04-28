create table if not exists public.order_cake_toppers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  child_name text,
  age text,
  theme text,
  photo_url text,
  cost numeric(10,2),
  charged_amount numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

alter table public.order_cake_toppers enable row level security;

drop policy if exists "Users can view their own cake toppers" on public.order_cake_toppers;
create policy "Users can view their own cake toppers"
on public.order_cake_toppers
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own cake toppers" on public.order_cake_toppers;
create policy "Users can insert their own cake toppers"
on public.order_cake_toppers
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own cake toppers" on public.order_cake_toppers;
create policy "Users can update their own cake toppers"
on public.order_cake_toppers
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own cake toppers" on public.order_cake_toppers;
create policy "Users can delete their own cake toppers"
on public.order_cake_toppers
for delete
using (auth.uid() = user_id);

create index if not exists order_cake_toppers_user_id_idx on public.order_cake_toppers(user_id);
create index if not exists order_cake_toppers_order_id_idx on public.order_cake_toppers(order_id);