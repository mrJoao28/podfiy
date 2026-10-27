-- Apply after 001_initial.sql. Idempotent; no service-role key needed by the app.
begin;

-- BEFORE UPDATE runs under the row lock taken by INSERT ... ON CONFLICT.
-- Protects direct writes by older clients as well as the new RPC.
create or replace function public.podfiy_guard_sync_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'sessoes_escuta' then
    if (new.payload->>'seconds')::numeric <= (old.payload->>'seconds')::numeric then
      return null;
    end if;
  elsif new.updated_at <= old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['podcasts_assinados','episodios_progresso','favoritos','fila','historico','sessoes_escuta','configuracoes'] loop
    execute format('drop trigger if exists podfiy_sync_guard on public.%I', t);
    execute format('create trigger podfiy_sync_guard before update on public.%I for each row execute function public.podfiy_guard_sync_update()', t);
  end loop;
end;
$$;

-- SECURITY INVOKER keeps the existing RLS policies in force. Allowlist identifiers
-- before dynamic SQL; the authenticated user may write only their own rows.
create or replace function public.podfiy_upsert_rows(p_table text, p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_table is null or not (p_table = any(array['podcasts_assinados','episodios_progresso','favoritos','fila','historico','sessoes_escuta','configuracoes'])) then
    raise exception 'Invalid sync table' using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected a row array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 200 then
    raise exception 'Batch too large' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_rows) as r where (r->>'user_id')::uuid is distinct from auth.uid()) then
    raise exception 'Account mismatch' using errcode = '42501';
  end if;
  execute format(
    'insert into public.%I as target (user_id,id,payload,updated_at)
     select user_id,id,payload,updated_at from jsonb_to_recordset($1)
       as r(user_id uuid,id text,payload jsonb,updated_at timestamptz)
     on conflict (user_id,id) do update
       set payload=excluded.payload, updated_at=excluded.updated_at', p_table
  ) using p_rows;
end;
$$;

revoke all on function public.podfiy_upsert_rows(text,jsonb) from public, anon;
grant execute on function public.podfiy_upsert_rows(text,jsonb) to authenticated;
revoke all on function public.podfiy_guard_sync_update() from public, anon;
commit;
