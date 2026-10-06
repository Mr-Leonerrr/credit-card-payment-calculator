begin;

do $$
begin
  if pg_catalog.to_regprocedure('public.is_valid_calculation_workspace_v5(jsonb)') is null then
    raise exception 'Apply migration 005_purchase_interest_free.sql before migration 006';
  end if;
end;
$$;

create or replace function public.is_valid_calculation_workspace_v6(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  card jsonb;
  purchase jsonb;
  payment jsonb;
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
    if card ? 'paymentHistory' then
      if pg_catalog.jsonb_typeof(card -> 'paymentHistory') <> 'array' then
        return false;
      end if;
      for payment in select value from pg_catalog.jsonb_array_elements(card -> 'paymentHistory') loop
        if pg_catalog.jsonb_typeof(payment) <> 'object'
          or payment - array['id', 'date', 'amount', 'availableApplied', 'availableChange']::text[] <> '{}'::jsonb
          or not (payment ?& array['id', 'date', 'amount', 'availableApplied', 'availableChange'])
          or pg_catalog.jsonb_typeof(payment -> 'id') <> 'string'
          or pg_catalog.jsonb_typeof(payment -> 'date') <> 'string'
          or pg_catalog.jsonb_typeof(payment -> 'availableApplied') <> 'boolean'
          or pg_catalog.jsonb_typeof(payment -> 'availableChange') not in ('string', 'number')
          or pg_catalog.jsonb_typeof(payment -> 'amount') not in ('string', 'number')
          or coalesce(payment ->> 'id', '') = ''
          or coalesce(payment ->> 'id', '') !~ '^[a-zA-Z0-9_-]{1,128}$'
          or coalesce(payment ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
          or length(coalesce(payment ->> 'amount', '')) > 32
          or coalesce(payment ->> 'amount', '') !~ '^[0-9]+(\.[0-9]+)?$'
          or pg_catalog.replace(coalesce(payment ->> 'amount', '0'), '.', '') !~ '[1-9]' then
          return false;
        end if;
        if length(coalesce(payment ->> 'availableChange', '')) > 32
          or coalesce(payment ->> 'availableChange', '') !~ '^[0-9]+(\.[0-9]+)?$' then
          return false;
        end if;
      end loop;
    end if;
    if card ? 'purchases' then
      if pg_catalog.jsonb_typeof(card -> 'purchases') <> 'array' then
        return false;
      end if;
      for purchase in select value from pg_catalog.jsonb_array_elements(card -> 'purchases') loop
        if pg_catalog.jsonb_typeof(purchase) <> 'object'
          or (purchase ? 'creditImpact'
            and pg_catalog.jsonb_typeof(purchase -> 'creditImpact') <> 'boolean') then
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
        (card.value - 'paymentHistory')
        || case
          when card.value ? 'purchases' then pg_catalog.jsonb_build_object(
            'purchases',
            coalesce((
              select pg_catalog.jsonb_agg(purchase.value - 'creditImpact')
              from pg_catalog.jsonb_array_elements(card.value -> 'purchases') as purchase(value)
            ), '[]'::jsonb)
          )
          else '{}'::jsonb
        end
      ),
      '[]'::jsonb
    ),
    false
  ) into legacy_payload
  from pg_catalog.jsonb_array_elements(p_payload -> 'cards') as card(value);

  return public.is_valid_calculation_workspace_v5(legacy_payload);
end;
$$;

revoke all on function public.is_valid_calculation_workspace_v6(jsonb)
  from public, anon, authenticated;

alter table public.calculation_workspaces
  drop constraint if exists calculation_workspaces_payload_check;
alter table public.calculation_workspaces
  add constraint calculation_workspaces_payload_check
  check (public.is_valid_calculation_workspace_v6(payload));

create or replace function public.is_valid_calculation_workspace(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.is_valid_calculation_workspace_v6(p_payload)
$$;

revoke all on function public.is_valid_calculation_workspace(jsonb)
  from public, anon, authenticated;

commit;
