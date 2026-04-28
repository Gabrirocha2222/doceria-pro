create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  customer_order_id uuid references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  title text not null,
  quantity numeric(10,2),
  unit text,
  due_date date,
  status text not null default 'pendente'
    check (status in ('pendente', 'encomendado', 'recebido', 'cancelado')),
  details jsonb,
  notes text,
  created_at timestamptz default now()
);

alter table public.supplier_orders enable row level security;

drop policy if exists "Users can view their own supplier orders" on public.supplier_orders;
create policy "Users can view their own supplier orders"
on public.supplier_orders
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own supplier orders" on public.supplier_orders;
create policy "Users can insert their own supplier orders"
on public.supplier_orders
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own supplier orders" on public.supplier_orders;
create policy "Users can update their own supplier orders"
on public.supplier_orders
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own supplier orders" on public.supplier_orders;
create policy "Users can delete their own supplier orders"
on public.supplier_orders
for delete
using (auth.uid() = user_id);

create index if not exists supplier_orders_user_id_idx
on public.supplier_orders(user_id);

create index if not exists supplier_orders_supplier_id_idx
on public.supplier_orders(supplier_id);

create index if not exists supplier_orders_customer_order_id_idx
on public.supplier_orders(customer_order_id);

create index if not exists supplier_orders_due_date_idx
on public.supplier_orders(due_date);
