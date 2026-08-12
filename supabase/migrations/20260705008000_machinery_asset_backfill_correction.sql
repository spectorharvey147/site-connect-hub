update public.machinery_contract_machines
set registration_number = case id
      when 'fd011398-0d17-44dc-9d19-e884ae272a34'::uuid then 'TN09AX4821'
      when '14301f6d-8b98-47aa-886a-a076f76f3e5b'::uuid then 'TN09AX5074'
      when '5e78c4bb-71cc-447e-9639-27ef4e7f976b'::uuid then 'TN09AX4930'
      else registration_number
    end,
    machine_number = case id
      when '14301f6d-8b98-47aa-886a-a076f76f3e5b'::uuid then 'TN-09-EX-5074'
      else machine_number
    end,
    updated_at = now()
where vendor_id is not null;

-- Force synchronization for every production contract machine.
update public.machinery_contract_machines
set status = status
where vendor_id is not null;

do $$
declare missing_count integer;
begin
  select count(*) into missing_count
  from public.machinery_contract_machines machine
  left join public.machine_assets asset on asset.contract_machine_id = machine.id
  where machine.vendor_id is not null and asset.id is null;
  if missing_count > 0 then
    raise exception 'Machine asset synchronization left % contract machines missing', missing_count;
  end if;
end $$;
