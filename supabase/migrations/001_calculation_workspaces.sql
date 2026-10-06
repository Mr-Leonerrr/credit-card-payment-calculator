begin;

create function public.is_valid_calculation_workspace(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  card jsonb;
  purchase jsonb;
begin
  if p_payload is null
    or pg_catalog.jsonb_typeof(p_payload) <> 'object'
    or pg_catalog.octet_length(p_payload::text) > 1048576
    or p_payload - 'cards' <> '{}'::jsonb
    or not (p_payload ? 'cards')
    or pg_catalog.jsonb_typeof(p_payload -> 'cards') <> 'array' then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(p_payload -> 'cards') not between 1 and 50 then
    return false;
  end if;
  for card in select value from pg_catalog.jsonb_array_elements(p_payload -> 'cards') loop
    if pg_catalog.jsonb_typeof(card) <> 'object' or card = '{}'::jsonb then
      return false;
    end if;
    if card - array[
      'id', 'name', 'rate', 'rateType', 'cutoffDay', 'referenceDate',
      'previousBalance', 'minimumPercent', 'minimumFloor', 'recurringCharges',
      'extraCharges', 'payments', 'interestFreeSingle', 'creditLimit',
      'availableCredit', 'purchases'
    ]::text[] <> '{}'::jsonb then
      return false;
    end if;
    if card ? 'purchases' then
      if pg_catalog.jsonb_typeof(card -> 'purchases') <> 'array' then
        return false;
      end if;
      for purchase in select value from pg_catalog.jsonb_array_elements(card -> 'purchases') loop
        if pg_catalog.jsonb_typeof(purchase) <> 'object' or purchase = '{}'::jsonb then
          return false;
        end if;
        if purchase - array[
          'id', 'description', 'amount', 'installments', 'paidInstallments',
          'date', 'rateOverride', 'rateOverrideType', 'entryMode', 'processDate',
          'statementBalance', 'statementRemaining', 'statementCapital', 'statementNextDate'
        ]::text[] <> '{}'::jsonb then
          return false;
        end if;
        if exists (
          select 1 from pg_catalog.jsonb_each(purchase) as field
          where pg_catalog.jsonb_typeof(field.value) not in ('string', 'number', 'boolean', 'null')
        ) then
          return false;
        end if;
      end loop;
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_each(card - 'purchases') as field
      where pg_catalog.jsonb_typeof(field.value) not in ('string', 'number', 'boolean', 'null')
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.is_valid_calculation_workspace(jsonb) from public, anon, authenticated;

create table public.calculation_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (public.is_valid_calculation_workspace(payload)),
  schema_version integer not null default 1 check (schema_version = 1),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.calculation_workspaces enable row level security;
revoke all on table public.calculation_workspaces from public, anon, authenticated;
grant select on table public.calculation_workspaces to authenticated;
create policy calculation_workspaces_owner_select
  on public.calculation_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.save_calculation_workspace(p_payload jsonb, p_expected_version bigint)
returns public.calculation_workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current_workspace public.calculation_workspaces;
begin
  if owner_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_VERSION';
  end if;
  if not public.is_valid_calculation_workspace(p_payload) then
    raise exception using errcode = '22023', message = 'INVALID_WORKSPACE_PAYLOAD';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  select * into current_workspace from public.calculation_workspaces where user_id = owner_id;
  if coalesce(current_workspace.version, 0) <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'SYNC_CONFLICT';
  end if;
  insert into public.calculation_workspaces as workspace (user_id, payload, version, updated_at)
    values (owner_id, p_payload, 1, pg_catalog.clock_timestamp())
    on conflict (user_id) do update
      set payload = excluded.payload, version = workspace.version + 1,
          updated_at = pg_catalog.clock_timestamp()
    returning * into current_workspace;
  return current_workspace;
end;
$$;

revoke all on function public.save_calculation_workspace(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_calculation_workspace(jsonb, bigint) to authenticated;

commit;
