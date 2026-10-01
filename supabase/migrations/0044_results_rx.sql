-- Scaling levels (elite / rx / scaled / foundation) replaced by one "RX" box: only RX scores are ranked.
-- Former elite scores count as RX, scaled and foundation as scaled. results.level is no longer read; dropped later,
-- once no client writes it.
alter table public.results add column rx boolean not null default true;
update public.results set rx = level in ('elite', 'rx');
