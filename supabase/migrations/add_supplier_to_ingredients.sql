alter table public.ingredients
add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists ingredients_supplier_id_idx
on public.ingredients(supplier_id);
