-- This dedicated demo is intentionally shared by all confirmed email accounts.
-- Enrol at confirmation, not on every login: removing membership stays effective.
create function shipment_demo.join_confirmed_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and new.email_confirmed_at is not null
     and not coalesce(new.is_anonymous, false) then
    if tg_op = 'INSERT' then
      insert into shipment_demo.members(user_id, role) values(new.id, 'coordinator')
      on conflict(user_id) do nothing;
    elsif old.email_confirmed_at is null then
      insert into shipment_demo.members(user_id, role) values(new.id, 'coordinator')
      on conflict(user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function shipment_demo.join_confirmed_account() from public, anon, authenticated;
create trigger shipment_demo_join_confirmed_account
after insert or update of email_confirmed_at on auth.users
for each row execute function shipment_demo.join_confirmed_account();

-- Include existing confirmed demo accounts; preserve explicitly assigned roles.
insert into shipment_demo.members(user_id, role)
select id, 'coordinator' from auth.users
where email is not null and email_confirmed_at is not null
  and not coalesce(is_anonymous, false)
on conflict(user_id) do nothing;
