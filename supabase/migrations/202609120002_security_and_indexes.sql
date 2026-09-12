alter function public.touch_updated_at() set search_path = '';

do $$
declare
  fk record;
  index_name text;
begin
  for fk in
    select
      ns.nspname as schema_name,
      tbl.relname as table_name,
      att.attname as column_name
    from pg_constraint con
    join pg_class tbl on tbl.oid = con.conrelid
    join pg_namespace ns on ns.oid = tbl.relnamespace
    join pg_attribute att on att.attrelid = tbl.oid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and cardinality(con.conkey) = 1
      and ns.nspname = 'public'
      and not exists (
        select 1
        from pg_index idx
        where idx.indrelid = tbl.oid
          and con.conkey[1] = any(idx.indkey::smallint[])
      )
  loop
    index_name := left('idx_' || fk.table_name || '_' || fk.column_name, 63);
    execute format(
      'create index if not exists %I on %I.%I (%I)',
      index_name,
      fk.schema_name,
      fk.table_name,
      fk.column_name
    );
  end loop;
end $$;
