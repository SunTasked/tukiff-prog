-- 0003's check let max_uses = null through (null is not a failure for CHECK).
delete from public.invitations where role = 'coach' and max_uses is distinct from 1 and uses = 0;
update public.invitations set revoked_at = coalesce(revoked_at, now()), max_uses = 1 where role = 'coach' and max_uses is distinct from 1;
alter table public.invitations drop constraint coach_invitation_single_use;
alter table public.invitations
  add constraint coach_invitation_single_use check (role <> 'coach' or coalesce(max_uses, 0) = 1);
