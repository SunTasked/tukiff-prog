-- Time scores may carry a tenth of a second ("7:32,4"): time_s becomes numeric(6,1).
alter table public.results alter column time_s type numeric(6,1);
alter table public.personal_records alter column time_s type numeric(6,1);
