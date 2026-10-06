begin;

create or replace function public.is_valid_calculation_workspace(p_payload jsonb)
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
          'statementBalance', 'statementRemaining', 'statementCapital',
          'statementPayment', 'statementIncludesExtras', 'statementExtraAmount',
          'statementNextDate'
        ]::text[] <> '{}'::jsonb then
          return false;
        end if;
        if exists (
          select 1 from pg_catalog.jsonb_each(purchase) as field
          where pg_catalog.jsonb_typeof(field.value) not in ('string', 'number', 'boolean', 'null')
        ) then
          return false;
        end if;
        if purchase ? 'statementIncludesExtras'
          and pg_catalog.jsonb_typeof(purchase -> 'statementIncludesExtras') <> 'boolean' then
          return false;
        end if;
        if coalesce((purchase ->> 'statementIncludesExtras')::boolean, false)
          and (
            coalesce(purchase ->> 'statementPayment', '') = ''
            or coalesce(purchase ->> 'statementExtraAmount', '') = ''
          ) then
          return false;
        end if;
        if not coalesce((purchase ->> 'statementIncludesExtras')::boolean, false)
          and coalesce(purchase ->> 'statementExtraAmount', '') <> '' then
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

revoke all on function public.is_valid_calculation_workspace(jsonb)
  from public, anon, authenticated;

commit;
