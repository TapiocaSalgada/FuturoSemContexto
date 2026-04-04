begin;

do $$
declare
  table_row record;
begin
  for table_row in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_row.tablename);
    execute format('alter table public.%I force row level security', table_row.tablename);
    execute format('drop policy if exists deny_anon_authenticated on public.%I', table_row.tablename);
    execute format(
      'create policy deny_anon_authenticated on public.%I for all to anon, authenticated using (false) with check (false)',
      table_row.tablename
    );
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

do $$
declare
  col_row record;
begin
  for col_row in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and lower(column_name) in ('password', 'email', 'token', 'secret', 'apikey', 'api_key', 'service_key')
  loop
    execute format(
      'revoke select (%I) on table public.%I from anon, authenticated',
      col_row.column_name,
      col_row.table_name
    );
  end loop;
end $$;

commit;
