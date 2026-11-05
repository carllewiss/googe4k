create table if not exists public.mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  customer_id uuid references public.customers(id),
  phone text not null,
  amount numeric(12,2) not null,
  merchant_request_id text,
  checkout_request_id text,
  mpesa_receipt_number text,
  status text not null default 'pending',
  result_desc text,
  created_by uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_mpesa_tx_invoice on public.mpesa_transactions(invoice_id);
create index if not exists idx_mpesa_tx_checkout on public.mpesa_transactions(checkout_request_id);
create index if not exists idx_mpesa_tx_status on public.mpesa_transactions(status);

grant select, insert, update on public.mpesa_transactions to authenticated;
grant all on public.mpesa_transactions to service_role;

alter table public.mpesa_transactions enable row level security;

create policy "staff_view_mpesa_tx"
  on public.mpesa_transactions for select to authenticated
  using (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'sales_agent'));

create policy "staff_insert_mpesa_tx"
  on public.mpesa_transactions for insert to authenticated
  with check (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'sales_agent'));

create policy "staff_update_mpesa_tx"
  on public.mpesa_transactions for update to authenticated
  using (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'sales_agent'));