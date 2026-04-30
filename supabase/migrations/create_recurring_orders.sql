create table if not exists public.recurring_order_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  occurrence_number integer not null,
  scheduled_date date,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_producao', 'entregue', 'cancelado')),
  theme text,
  notes text,
  created_at timestamptz default now()
);

alter table public.recurring_order_occurrences enable row level security;

drop policy if exists "Users can view their own recurring order occurrences" on public.recurring_order_occurrences;
create policy "Users can view their own recurring order occurrences"
on public.recurring_order_occurrences
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own recurring order occurrences" on public.recurring_order_occurrences;
create policy "Users can insert their own recurring order occurrences"
on public.recurring_order_occurrences
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own recurring order occurrences" on public.recurring_order_occurrences;
create policy "Users can update their own recurring order occurrences"
on public.recurring_order_occurrences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own recurring order occurrences" on public.recurring_order_occurrences;
create policy "Users can delete their own recurring order occurrences"
on public.recurring_order_occurrences
for delete
using (auth.uid() = user_id);

create index if not exists recurring_order_occurrences_user_id_idx
on public.recurring_order_occurrences(user_id);

create index if not exists recurring_order_occurrences_order_id_idx
on public.recurring_order_occurrences(order_id);

create index if not exists recurring_order_occurrences_scheduled_date_idx
on public.recurring_order_occurrences(scheduled_date);

alter table public.orders
add column if not exists is_recurring boolean not null default false;

alter table public.orders
add column if not exists recurrence_type text default 'mensal';

alter table public.orders
add column if not exists recurrence_count integer;

alter table public.orders
add column if not exists first_occurrence_date date;
