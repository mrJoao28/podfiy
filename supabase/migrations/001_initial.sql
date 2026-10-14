-- Execute no SQL Editor do projeto Supabase. Idempotente.
-- Cada tabela guarda registros do domínio em JSONB. Coleções usam id='snapshot'.
begin;
do $$
declare t text;
begin
 foreach t in array array['podcasts_assinados','episodios_progresso','favoritos','fila','historico','sessoes_escuta','configuracoes'] loop
  execute format('create table if not exists public.%I (user_id uuid not null references auth.users(id) on delete cascade, id text not null, payload jsonb not null, updated_at timestamptz not null default now(), primary key (user_id,id))',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists proprietario on public.%I',t);
  execute format('create policy proprietario on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select, insert, update, delete on public.%I to authenticated',t);
 end loop;
end $$;
commit;
