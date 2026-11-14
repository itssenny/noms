-- Active pantry membership is personal and independent of stock status.
begin;
alter table public.inventory add column if not exists is_active boolean not null default true;
-- Inactive ingredients must have a known zero quantity; unknown stock is still stock.
alter table public.inventory drop constraint if exists inactive_inventory_is_empty;
alter table public.inventory add constraint inactive_inventory_is_empty
 check(is_active or (quantity is not null and quantity=0));
create or replace function public.reactivate_restocked_inventory()
returns trigger language plpgsql set search_path='' as $$
begin
 -- Purchases and quantity updates reuse the same record. Explicit attempts to
 -- deactivate positive/unknown stock still fail the constraint above.
 if old.is_active=false and new.is_active=false and new.quantity is distinct from old.quantity
    and (new.quantity is null or new.quantity>0) then
  new.is_active=true;
 end if;
 return new;
end $$;
drop trigger if exists reactivate_restocked_inventory on public.inventory;
create trigger reactivate_restocked_inventory before update of quantity on public.inventory
 for each row execute function public.reactivate_restocked_inventory();
-- Existing inventory ownership RLS and the (user_id, ingredient_id) unique key
-- continue to protect membership and prevent duplicate records.
commit;
