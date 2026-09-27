# TKF Programming (tukiff-prog)

PWA de programmation CrossFit pour un petit groupe (coachs et athlètes), en français.

- **Production** : https://tukiff-prog.vercel.app (branche `main`)
- **Previews** : chaque branche poussée est déployée par Vercel (`tukiff-prog-git-<branche>-tukiff.vercel.app`)

## Stack

- Front : Vite + React + TypeScript + Tailwind, `vite-plugin-pwa` (installable sur iPhone et Android).
- Back : Supabase (Postgres + RLS, Auth par code email / mot de passe, Edge Function `join`).
- Hébergement : Vercel (build `npm run build`, réécriture SPA dans `vercel.json`).

Un seul projet Supabase sert la production et les previews.

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

Ils utilisent l'API Management de Supabase et lisent ces variables d'environnement :

| Variable | Usage |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_AUTH_TOKEN` | jeton personnel Supabase (Management API) |
| `VERCEL_TOKEN` | jeton Vercel (`vercel-setup.mjs`) |
| `SMTP_USER`, `SMTP_PASSWORD` | compte Gmail et mot de passe d'application (`auth-config.mjs`) |

| Commande | Rôle |
| --- | --- |
| `node scripts/migrate.mjs [--dry-run]` | applique les migrations `supabase/migrations/*.sql` pas encore passées |
| `node scripts/gen-types.mjs` | régénère `src/lib/database.types.ts` depuis le schéma |
| `node scripts/deploy-functions.mjs [nom]` | déploie les Edge Functions (`join`) |
| `node scripts/auth-config.mjs <siteUrl>` | configure Auth : URLs, code à 6 chiffres, politique de mot de passe, SMTP Gmail et emails en français |
| `node scripts/vercel-setup.mjs` | pousse les variables `VITE_SUPABASE_*` dans Vercel |
| `node scripts/admin.mjs list \| create-user \| set-role \| login-link \| delete-user` | gestion ponctuelle des comptes |
| `node scripts/seed-dev.mjs [--clean]` | crée (ou supprime avec `--clean`) le jeu de test `*@tkf.test`, mot de passe `a` |

## Déploiement

1. Migrations : `node scripts/migrate.mjs` puis `node scripts/gen-types.mjs` (commiter le fichier de types).
2. Edge Functions modifiées : `node scripts/deploy-functions.mjs`.
3. Pousser la branche : Vercel déploie une preview. Merger dans `main` déploie la production.
4. Après un changement d'URL de production : `node scripts/auth-config.mjs https://tukiff-prog.vercel.app`.

Une nouvelle migration s'ajoute sous la forme `supabase/migrations/00NN_nom.sql` (numéro suivant, jamais modifier une migration déjà appliquée).

## Ajouter un membre

Les inscriptions sont fermées : on rejoint l'app uniquement avec un lien d'invitation.

1. Un coach ouvre **Athlètes / Membres → Inviter** et crée un lien **athlète** (usage unique ou valable 24 h), en choisissant les programmations. Seuls les admins créent des liens **coach**.
2. Il envoie le lien. La personne saisit son email, reçoit un code à 6 chiffres, puis choisit un pseudo et un mot de passe.
3. Les rôles (athlète / coach / admin) se changent ensuite depuis la fiche du membre, par un admin.

## Rôles

- **Athlète** : voit les séances des programmations auxquelles il a accès, saisit ses scores et records.
- **Coach** : gère la bibliothèque et le planning des programmations dont il est propriétaire ou contributeur, invite des athlètes.
- **Admin** : coach qui gère les rôles, les invitations coach et le retrait d'accès. Le propriétaire de l'app ne peut être ni rétrogradé ni supprimé.
