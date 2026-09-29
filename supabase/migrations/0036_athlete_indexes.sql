-- Per-athlete lookups (own results, skips, reactions, RLS checks) stay fast as the member count grows.
create index if not exists results_athlete_id_idx on public.results (athlete_id);
create index if not exists block_skips_athlete_id_idx on public.block_skips (athlete_id);
create index if not exists block_reactions_user_id_idx on public.block_reactions (user_id);
