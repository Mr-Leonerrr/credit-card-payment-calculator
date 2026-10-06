begin;

do $$
begin
  if pg_catalog.to_regprocedure('public.is_valid_calculation_workspace_v4(jsonb)') is null then
    raise exception 'Apply migration 004_previous_balance_interest_breakdown.sql before migration 005';
  end if;
end;
$$;

create or replace function public.is_valid_calculation_workspace_v5(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  card jsonb;
  purchase jsonb;
  legacy_payload jsonb;
begin
  if p_payload is null
    or pg_catalog.jsonb_typeof(p_payload) <> 'object'
    or not (p_payload ? 'cards')
    or pg_catalog.jsonb_typeof(p_payload -> 'cards') <> 'array' then
    return false;
  end if;

  for card in select value from pg_catalog.jsonb_array_elements(p_payload -> 'cards') loop
    if pg_catalog.jsonb_typeof(card) <> 'object' then
      return false;
    end if;
    if card ? 'purchases' then
      if pg_catalog.jsonb_typeof(card -> 'purchases') <> 'array' then
        return false;
      end if;
      for purchase in select value from pg_catalog.jsonb_array_elements(card -> 'purchases') loop
        if pg_catalog.jsonb_typeof(purchase) <> 'object'
          or (purchase ? 'interestFree'
            and pg_catalog.jsonb_typeof(purchase -> 'interestFree') <> 'boolean') then
          return false;
        end if;
      end loop;
    end if;
  end loop;

  select pg_catalog.jsonb_set(
    p_payload,
    '{cards}',
    coalesce(
      pg_catalog.jsonb_agg(
        case
          when card.value ? 'purchases' then pg_catalog.jsonb_set(
            card.value,
            '{purchases}',
            coalesce((
              select pg_catalog.jsonb_agg(purchase.value - 'interestFree')
              from pg_catalog.jsonb_array_elements(card.value -> 'purchases') as purchase(value)
            ), '[]'::jsonb),
            false
          )
          else card.value
        end
      ),
      '[]'::jsonb
    ),
    false
  ) into legacy_payload
  from pg_catalog.jsonb_array_elements(p_payload -> 'cards') as card(value);

  return public.is_valid_calculation_workspace_v4(legacy_payload);
end;
$$;

revoke all on function public.is_valid_calculation_workspace_v5(jsonb)
  from public, anon, authenticated;

alter table public.calculation_workspaces
  drop constraint if exists calculation_workspaces_payload_check;
alter table public.calculation_workspaces
  add constraint calculation_workspaces_payload_check
  check (public.is_valid_calculation_workspace_v5(payload));

create or replace function public.is_valid_calculation_workspace(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.is_valid_calculation_workspace_v5(p_payload)
$$;

revoke all on function public.is_valid_calculation_workspace(jsonb)
  from public, anon, authenticated;

commit;
