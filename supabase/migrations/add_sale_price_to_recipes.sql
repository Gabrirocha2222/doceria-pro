alter table public.recipes
add column if not exists sale_price numeric(10,2);
