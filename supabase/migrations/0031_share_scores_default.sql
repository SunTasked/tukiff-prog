-- Scores shared by default: new accounts and every existing one (user decision 2026-09-28).
-- Each athlete can still turn it off in their profile; the program leaderboard toggle still applies.
alter table public.profiles alter column share_scores set default true;
update public.profiles set share_scores = true where not share_scores;
