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

## Charte graphique (à discuter)
- Logo de référence : `docs/brand/tkf-logo.jpg` (TKF = Tukiff Programming).
- L'application doit s'aligner sur l'aspect sobre du logo : noir et blanc, typographie
  italique/anguleuse pour les titres, capitales espacées pour les sous-titres, très peu de couleur.
- À revoir : couleur d'accent actuelle (vert citron) à remplacer ou réduire, nom affiché
  (« TKF Programming » au lieu de « Tukiff Prog »), icônes PWA à regénérer depuis le logo
  (idéalement une version vectorielle / PNG haute définition sur fond transparent).
