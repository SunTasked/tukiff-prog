# TKF Programming (tukiff-prog)

PWA de programmation CrossFit pour un petit groupe (coachs et athlètes), en français.

- **Production** : https://tukiff-prog.vercel.app (branche `main`)
- **Previews** : chaque branche poussée est déployée par Vercel (`tukiff-prog-git-<branche>-tukiff.vercel.app`)
- **Staging** : https://tukiff-prog-staging.vercel.app (branche `staging`, pré-prod qui accumule les features en attente de release), sur Supabase staging

## Stack

- Front : Vite + React + TypeScript + Tailwind, `vite-plugin-pwa` (installable sur iPhone et Android).
- Back : Supabase (Postgres + RLS, Auth par code email / mot de passe, Edge Function `join`).
- Hébergement : Vercel (build `npm run build`, réécriture SPA dans `vercel.json`).

Deux projets Supabase : **prod** (`TKF-program`) pour la production, **staging** (`TKF-staging`) pour les previews et le développement local.

## Développement local

```sh
npm ci
cp .env.example .env.local   # puis renseigner les deux variables
npm run dev                  # http://localhost:5173
```

`.env.local` :

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<clé publishable>
```

Vérifications avant de pousser :

```sh
npm test          # Vitest (logique métier dans src/domain)
npm run lint      # oxlint
npm run build     # tsc -b + build Vite
```

## Scripts d'administration

Ils utilisent l'API Management de Supabase. Ils visent **staging par défaut** ; la prod uniquement avec `TARGET=prod`
(ex. `TARGET=prod node scripts/migrate.mjs`). Chaque script affiche sa cible au démarrage.

Variables d'environnement :

| Variable | Usage |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase de prod |
| `SUPABASE_STAGING_URL` | URL du projet Supabase de staging |
| `SUPABASE_AUTH_TOKEN` | jeton Supabase (Management API) couvrant les deux projets |
| `VERCEL_TOKEN` | jeton Vercel (`vercel-setup.mjs`) |
| `SMTP_USER`, `SMTP_PASSWORD` | compte Gmail et mot de passe d'application (`auth-config.mjs`) |

| Commande | Rôle |
| --- | --- |
| `node scripts/migrate.mjs [--dry-run]` | applique les migrations `supabase/migrations/*.sql` pas encore passées |
| `node scripts/gen-types.mjs` | régénère `src/lib/database.types.ts` depuis le schéma |
| `node scripts/deploy-functions.mjs [nom]` | déploie les Edge Functions (`join`) |
| `node scripts/auth-config.mjs <siteUrl>` | configure Auth : URLs, politique de mot de passe, SMTP Gmail et emails en français |
| `node scripts/vercel-setup.mjs` | pousse les variables `VITE_SUPABASE_*` dans Vercel (prod → production, staging → previews) |
| `node scripts/admin.mjs list \| create-user \| set-role \| login-link \| delete-user` | gestion ponctuelle des comptes |
| `node scripts/reset-staging.mjs [--go] [--prod-data] [--no-seed]` | reconstruit la base staging : migrations de la prod, bibliothèque d'exercices de la prod (ou toutes ses données avec `--prod-data`, emails réels compris), migrations pas encore en prod, puis `seed-dev`. Sans `--go`, affiche seulement le plan. Refuse `TARGET=prod` ; la prod n'est que lue |
| `node scripts/seed-dev.mjs [--clean]` | crée (ou supprime avec `--clean`) le jeu de test `*@tkf.test`, mot de passe `a`, décrit avec les cas à valider dans `docs/staging-use-cases.md` ; sur la prod, seul `--clean` est accepté |

## Déploiement

`main` = production, `staging` = pré-prod. Les features passent par `staging`, la prod reçoit des lots (releases).

1. **Feature** : branche depuis `staging`, PR vers `staging`. Sur la base staging : `node scripts/migrate.mjs`,
   `node scripts/gen-types.mjs` (commiter le fichier de types) et `node scripts/deploy-functions.mjs` si une Edge Function
   a changé. La PR ajoute ses nouveautés dans `releases/next-update/<feature>.json` (voir `releases/README.md`).
   La preview Vercel de la PR utilise la base staging. Merger dans `staging` : l'URL staging affiche la feature.
2. **Release** : branche depuis `staging`, `node scripts/release.mjs <mineur|correctif|majeur>` (mise à jour des
   dépendances et correction des vulnérabilités, lint/tests/build, version et notes `releases/v<version>.json`), PR
   vers `staging`, merge, puis **test de l'app sur l'URL staging avec ces mises à jour**. Ensuite PR de `staging` vers
   `main` ; la CI y refuse une version non montée, des notes manquantes ou une vulnérabilité haute. Juste avant le merge : `TARGET=prod node scripts/migrate.mjs` (applique
   en lot les migrations du lot) et `deploy-functions` si besoin. Merger avec un **merge commit, jamais squash ni
   rebase**, sinon `staging` et `main` divergent. Vercel déploie la production, le tag `v<version>` et la release
   GitHub sont créés automatiquement.
3. **Correctif urgent** : branche depuis `main`, note dans `releases/next-update/`, `node scripts/release.mjs correctif`,
   PR vers `main`, puis fusionner `main` dans `staging`
   (PR `main` → `staging`, merge commit).
4. Après un changement d'URL : `TARGET=prod node scripts/auth-config.mjs https://tukiff-prog.vercel.app`.

La CI (lint, tests, build) tourne sur chaque PR et sur les pushs dans `main` et `staging`.

Les migrations arrivent sur la base staging avant la prod : elles doivent rester compatibles avec le code de la prod
(ajouts plutôt que suppressions ; une colonne se supprime dans une release suivante). Une feature abandonnée dont la
migration est déjà sur staging : migration inverse, ou `node scripts/reset-staging.mjs --go` depuis `staging` à jour
(la base est reconstruite avec les seules migrations présentes dans la branche).

Une nouvelle migration s'ajoute sous la forme `supabase/migrations/00NN_nom.sql` (numéro suivant, jamais modifier une migration déjà appliquée).

## Sauvegardes

La tâche GitHub « Sauvegarde base » fait un `pg_dump` de la prod chaque nuit (schémas `public` et `auth`), gardé 90 jours
dans les artefacts GitHub Actions. Elle lit le secret `SUPABASE_DB_URL` (chaîne « Session pooler » de la prod) et peut
se lancer à la main depuis l'onglet Actions. Restauration : `pg_restore --no-owner --data-only -d <url> backup.dump` sur une
base où les migrations sont déjà appliquées.

## Ajouter un membre

Les inscriptions sont fermées : on rejoint l'app uniquement avec un lien d'invitation.

1. Un coach ouvre **Athlètes / Membres → Inviter** et crée un lien **athlète** (usage unique ou valable 24 h), en choisissant les programmations. Seuls les admins créent des liens **coach**.
2. Il envoie le lien. La personne saisit son email, reçoit un code à 6 chiffres, puis choisit un pseudo et un mot de passe.
3. Les rôles (athlète / coach / admin) se changent ensuite depuis la fiche du membre, par un admin.

## Rôles

- **Athlète** : voit les séances des programmations auxquelles il a accès, saisit ses scores et records.
- **Coach** : gère la bibliothèque et le planning des programmations dont il est propriétaire ou contributeur, invite des athlètes.
- **Admin** : coach qui gère les rôles, les invitations coach et le retrait d'accès. Le propriétaire de l'app ne peut être ni rétrogradé ni supprimé.
