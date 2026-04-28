alter table public.orders add column if not exists fulfillment_type text default 'retirada'
  check (fulfillment_type in ('retirada', 'entrega'));

alter table public.orders add column if not exists delivery_fee numeric(10,2) default 0;
alter table public.orders add column if not exists down_payment numeric(10,2) default 0;
alter table public.orders add column if not exists remaining_amount numeric(10,2) default 0;
alter table public.orders add column if not exists remaining_payment_date date;
alter table public.orders add column if not exists discount_amount numeric(10,2) default 0;
alter table public.orders add column if not exists manual_total numeric(10,2);
alter table public.orders add column if not exists extras_total numeric(10,2) default 0;

create table if not exists public.order_extras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  name text not null,
  amount numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz default now()
);

alter table public.order_extras enable row level security;

drop policy if exists "Users can view their own order extras" on public.order_extras;
create policy "Users can view their own order extras"
on public.order_extras
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own order extras" on public.order_extras;
create policy "Users can insert their own order extras"
on public.order_extras
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own order extras" on public.order_extras;
create policy "Users can update their own order extras"
on public.order_extras
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own order extras" on public.order_extras;
create policy "Users can delete their own order extras"
on public.order_extras
for delete
using (auth.uid() = user_id);

create index if not exists order_extras_user_id_idx on public.order_extras(user_id);
create index if not exists order_extras_order_id_idx on public.order_extras(order_id);