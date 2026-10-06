begin;

do $$
begin
  if pg_catalog.to_regprocedure('public.is_valid_calculation_workspace_v3(jsonb)') is null then
    raise exception 'Apply migration 003_previous_balance_charges.sql before migration 004';
  end if;
end;
$$;

create or replace function public.is_valid_calculation_workspace_v4(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  card jsonb;
  included jsonb;
  legacy_payload jsonb;
begin
  if p_payload is null
    or pg_catalog.jsonb_typeof(p_payload) <> 'object'
    or not (p_payload ? 'cards')
    or pg_catalog.jsonb_typeof(p_payload -> 'cards') <> 'array' then
    return false;
  end if;

  for card in select value from pg_catalog.jsonb_array_elements(p_payload -> 'cards') loop
    if card ? 'previousBalanceIncludesCharges'
      and pg_catalog.jsonb_typeof(card -> 'previousBalanceIncludesCharges') <> 'boolean' then
      return false;
    end if;
    if card ? 'previousBalanceIncludedCharges' then
      included := card -> 'previousBalanceIncludedCharges';
      if pg_catalog.jsonb_typeof(included) not in ('string', 'number')
        or coalesce(included #>> '{}', '') !~ '^[0-9]+(\.[0-9]+)?$' then
        return false;
      end if;
    end if;
    if coalesce((card ->> 'previousBalanceIncludesCharges')::boolean, false)
      and coalesce(card ->> 'previousBalanceIncludedCharges', '') = '' then
      return false;
    end if;
    if coalesce((card ->> 'previousBalanceIncludesCharges')::boolean, false)
      and coalesce(card ->> 'previousBalanceIncludedCharges', '') !~ '^[0-9]+(\.[0-9]+)?$' then
      return false;
    end if;
    if coalesce((card ->> 'previousBalanceIncludesCharges')::boolean, false)
      and coalesce(card ->> 'previousBalanceIncludedCharges', '0')::numeric >
        coalesce(card ->> 'previousBalance', '0')::numeric then
      return false;
    end if;
    if not coalesce((card ->> 'previousBalanceIncludesCharges')::boolean, false)
      and coalesce(card ->> 'previousBalanceIncludedCharges', '') <> '' then
      return false;
    end if;
  end loop;

  select pg_catalog.jsonb_set(
    p_payload,
    '{cards}',
    coalesce(
      pg_catalog.jsonb_agg(
        card.value - 'previousBalanceIncludesCharges' - 'previousBalanceIncludedCharges'
      ),
      '[]'::jsonb
    ),
    false
  ) into legacy_payload
  from pg_catalog.jsonb_array_elements(p_payload -> 'cards') as card(value);

  return public.is_valid_calculation_workspace_v3(legacy_payload);
end;
$$;

revoke all on function public.is_valid_calculation_workspace_v4(jsonb)
  from public, anon, authenticated;

alter table public.calculation_workspaces
  drop constraint if exists calculation_workspaces_payload_check;
alter table public.calculation_workspaces
  add constraint calculation_workspaces_payload_check
  check (public.is_valid_calculation_workspace_v4(payload));

create or replace function public.is_valid_calculation_workspace(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.is_valid_calculation_workspace_v4(p_payload)
$$;

revoke all on function public.is_valid_calculation_workspace(jsonb)
  from public, anon, authenticated;

commit;
