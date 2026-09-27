-- Coach invitations are always single-use.
update public.invitations set revoked_at = now() where role = 'coach' and max_uses is distinct from 1 and revoked_at is null;
alter table public.invitations
  add constraint coach_invitation_single_use check (role <> 'coach' or max_uses = 1) not valid;
