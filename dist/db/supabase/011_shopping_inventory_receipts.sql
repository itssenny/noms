-- User-specific inventory categories and atomic, retry-safe purchase intake.
begin;
alter table public.inventory add column if not exists category_override text check(category_override is null or length(trim(category_override)) between 1 and 100);
create table if not exists public.shopping_receipts (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 ingredient_id uuid not null references public.ingredients(id),
 quantity numeric not null check(quantity>0),unit text not null,
 created_at timestamptz not null default now()
);
alter table public.shopping_receipts enable row level security;
drop policy if exists "Read own shopping receipts" on public.shopping_receipts;
create policy "Read own shopping receipts" on public.shopping_receipts for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Create own shopping receipts" on public.shopping_receipts;
create policy "Create own shopping receipts" on public.shopping_receipts for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.ingredients where id=ingredient_id));
grant select,insert on public.shopping_receipts to authenticated;
revoke all on public.shopping_receipts from anon;
create or replace function public.receive_shopping_item(p_receipt_id uuid,p_ingredient_id uuid,p_quantity numeric,p_unit text,p_location text default 'Pantry')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare stock public.inventory%rowtype; receipt public.shopping_receipts%rowtype; ingredient public.ingredients%rowtype; added numeric;
begin
 if auth.uid() is null then raise exception 'Please sign in again'; end if;
 if p_quantity is null or p_quantity<=0 or p_unit is null or length(trim(p_unit))=0 then raise exception 'Enter the actual quantity purchased and its unit'; end if;
 if p_location not in ('Fridge','Freezer','Pantry') then raise exception 'Choose a storage location'; end if;
 select * into ingredient from public.ingredients where id=p_ingredient_id;
 if not found then raise exception 'Choose a visible catalogue ingredient'; end if;
 -- The receipt is inserted first; a conflicting concurrent retry waits here.
 insert into public.shopping_receipts(id,user_id,ingredient_id,quantity,unit) values(p_receipt_id,auth.uid(),p_ingredient_id,p_quantity,p_unit) on conflict(id) do nothing;
 if not found then
  select * into receipt from public.shopping_receipts where id=p_receipt_id and user_id=auth.uid();
  if not found or receipt.ingredient_id<>p_ingredient_id or receipt.quantity<>p_quantity or receipt.unit<>p_unit then raise exception 'This purchase was already recorded with different details'; end if;
 else
  insert into public.inventory(user_id,ingredient_id,quantity,unit,storage_location,low_stock_threshold) values(auth.uid(),p_ingredient_id,0,p_unit,p_location,0) on conflict(user_id,ingredient_id) do nothing;
  select * into stock from public.inventory where user_id=auth.uid() and ingredient_id=p_ingredient_id for update;
  if stock.quantity=0 then
   update public.inventory set quantity=p_quantity,unit=p_unit,updated_at=now() where id=stock.id;
  else
   added=case when stock.unit=p_unit and p_unit<>'other' then p_quantity
    when stock.unit='g' and p_unit='kg' then p_quantity*1000 when stock.unit='kg' and p_unit='g' then p_quantity/1000
    when stock.unit='ml' and p_unit='l' then p_quantity*1000 when stock.unit='l' and p_unit='ml' then p_quantity/1000
    when stock.unit in ('pcs','piece') and p_unit in ('pcs','piece') then p_quantity else null end;
   if added is null then raise exception 'Inventory uses a different unit. Enter the purchased amount in the inventory unit'; end if;
   update public.inventory set quantity=quantity+added,updated_at=now() where id=stock.id;
  end if;
 end if;
 select * into stock from public.inventory where user_id=auth.uid() and ingredient_id=p_ingredient_id;
 if not found then raise exception 'This purchase was recorded already. Update inventory manually if the stock entry was removed'; end if;
 return jsonb_build_object('inventory',to_jsonb(stock),'ingredient',jsonb_build_object('id',ingredient.id,'canonical_name',ingredient.canonical_name,'category',ingredient.category));
end $$;
revoke all on function public.receive_shopping_item(uuid,uuid,numeric,text,text) from public,anon;
grant execute on function public.receive_shopping_item(uuid,uuid,numeric,text,text) to authenticated;
commit;
