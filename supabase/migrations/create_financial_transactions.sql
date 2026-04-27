create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('entrada', 'saida')),
  description text not null,
  amount numeric(10,2) not null,
  category text,
  transaction_date date not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.financial_transactions enable row level security;

drop policy if exists "Users can view their own financial transactions" on public.financial_transactions;
create policy "Users can view their own financial transactions"
on public.financial_transactions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own financial transactions" on public.financial_transactions;
create policy "Users can insert their own financial transactions"
on public.financial_transactions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own financial transactions" on public.financial_transactions;
create policy "Users can update their own financial transactions"
on public.financial_transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own financial transactions" on public.financial_transactions;
create policy "Users can delete their own financial transactions"
on public.financial_transactions
for delete
using (auth.uid() = user_id);

create index if not exists financial_transactions_user_id_idx
on public.financial_transactions(user_id);

create index if not exists financial_transactions_transaction_date_idx
on public.financial_transactions(transaction_date);
