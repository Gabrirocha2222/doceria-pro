alter table public.ingredients add column if not exists stock_quantity numeric(10,2) default 0;
alter table public.ingredients add column if not exists stock_unit text;
