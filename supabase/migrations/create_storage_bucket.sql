-- Criar o bucket pedidos-fotos se não existir
insert into storage.buckets (id, name, public)
values ('pedidos-fotos', 'pedidos-fotos', true)
on conflict (id) do update set public = true;

-- Criar políticas de acesso
create policy "Qualquer pessoa pode ver as fotos de pedidos"
  on storage.objects for select
  using ( bucket_id = 'pedidos-fotos' );

create policy "Usuários autenticados podem fazer upload de fotos de pedidos"
  on storage.objects for insert
  with check (
    bucket_id = 'pedidos-fotos'
    and auth.role() = 'authenticated'
  );

create policy "Usuários autenticados podem atualizar fotos de pedidos"
  on storage.objects for update
  using (
    bucket_id = 'pedidos-fotos'
    and auth.role() = 'authenticated'
  );

create policy "Usuários autenticados podem deletar fotos de pedidos"
  on storage.objects for delete
  using (
    bucket_id = 'pedidos-fotos'
    and auth.role() = 'authenticated'
  );
