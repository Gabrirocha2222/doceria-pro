create table if not exists public.production_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  production_date date not null,
  start_time time,
  end_time time,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  recipe_id uuid references public.recipes(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  quantity numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

alter table public.production_schedule enable row level security;

drop policy if exists "Users can view their own production schedule" on public.production_schedule;
create policy "Users can view their own production schedule"
on public.production_schedule
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own production schedule" on public.production_schedule;
create policy "Users can insert their own production schedule"
on public.production_schedule
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own production schedule" on public.production_schedule;
create policy "Users can update their own production schedule"
on public.production_schedule
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own production schedule" on public.production_schedule;
create policy "Users can delete their own production schedule"
on public.production_schedule
for delete
using (auth.uid() = user_id);

create index if not exists production_schedule_user_id_idx
on public.production_schedule(user_id);

create index if not exists production_schedule_production_date_idx
on public.production_schedule(production_date);
