alter table public.supplier_orders
add column if not exists estimated_cost numeric(10,2);
