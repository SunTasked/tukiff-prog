# Backlog / specs reportées

## Programmes d'entraînement (prévu en M3)
- L'application peut contenir plusieurs programmes (ex. « CrossFit », « Haltéro », « Prépa Hyrox »).
- Un athlète a accès à un ou plusieurs programmes ; il ne voit que les séances des programmes auxquels il a accès.
- À la création d'un lien d'invitation, le coach peut associer un ou plusieurs programmes :
  un utilisateur qui rejoint avec ce lien obtient automatiquement l'accès à ces programmes.
- Un utilisateur déjà membre qui ouvre un tel lien obtient l'accès aux programmes du lien.

Modèle envisagé (remplace la notion de « groupe » du cadrage M0) :
- `programs(id, name, description, created_by, archived_at)`
- `program_members(program_id, user_id)`
- `invitation_programs(invitation_id, program_id)` — lu par `accept_invitation()`
- Assignation d'une séance : à un programme (tous ses membres) ou à un athlète.
