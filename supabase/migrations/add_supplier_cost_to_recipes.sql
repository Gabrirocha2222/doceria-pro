alter table public.recipes
add column if not exists supplier_cost numeric(10,2);

alter table public.recipes
add column if not exists supplier_cost_unit text;
