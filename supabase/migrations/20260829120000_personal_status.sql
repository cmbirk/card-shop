-- cards.status gains 'personal': Chris's own collection, displayed in the Colts Room,
-- never for sale. Rides the public view unchanged; the client hides price/basket for it.
alter table public.cards drop constraint if exists cards_status_check;
alter table public.cards
  add constraint cards_status_check
  check (status in ('available', 'reserved', 'sold', 'personal'));
