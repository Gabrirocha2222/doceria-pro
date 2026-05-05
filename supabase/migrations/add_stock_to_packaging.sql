alter table public.packaging
add column if not exists stock_quantity numeric(10,2) default 0;

alter table public.packaging
add column if not exists stock_unit text default 'unidade';

alter table public.packaging
add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists packaging_supplier_id_idx
on public.packaging(supplier_id);
