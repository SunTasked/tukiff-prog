# Staging : jeu de données et cas à valider

Base de staging (Supabase TKF-staging, previews Vercel) peuplée par `node scripts/seed-dev.mjs`.
Le script est relançable : il supprime les comptes `*@tkf.test` et tout ce qu'ils ont créé, puis recrée tout.
Les dates sont relatives au jour du lancement : la semaine en cours a toujours des séances.
Les scores ne sont saisis que sur les séances déjà publiées : relancer le script en fin de semaine donne plus de scores.

À refaire après chaque nouvelle fonctionnalité : ajouter les données dans le script et le cas ici.

## Comptes (mot de passe `a`)

| Email | Pseudo | Rôle | Genre | Niveau | Particularité |
|---|---|---|---|---|---|
| c1@tkf.test | Max | coach, admin | H | elite / rx | photo ; owner CrossFit, Haltéro, Open Gym, Perso a3 |
| c2@tkf.test | Julie | coach | F | rx | photo ; owner Hyrox, contributrice CrossFit |
| a1@tkf.test | Léa | athlète | F | rx / elite | photo ; ne saute aucune séance (leader F attendue) |
| a2@tkf.test | Tom | athlète | H | rx | |
| a3@tkf.test | Sarah | athlète | F | scaled | programme perso ; pas de 1RM Back Squat / Hang Clean |
| a4@tkf.test | Hugo | athlète | H | elite | photo ; meilleur niveau (leader H attendu) |
| a5@tkf.test | Inès | athlète | F | foundation | |
| a6@tkf.test | Nico | athlète | H | scaled / rx | |
| a7@tkf.test | Emma | athlète | F | rx | |
| a8@tkf.test | Paul | athlète | H | rx | ne saisit jamais rien (compte rendu vide) |
| a9@tkf.test | Chloé | athlète | F | scaled | |
| a10@tkf.test | Karim | athlète | H | rx | |
| n1@tkf.test | n1 | athlète | aucun | | genre non renseigné : écran d'accueil (onboarding) |

## Programmes

| Programme | Owner | Contributeurs | Membres | Réactions | Classement |
|---|---|---|---|---|---|
| CrossFit (équivalent de « Kanda WOD » en prod) | c1 | c2 | tous | oui | oui |
| Haltéro | c1 | | c1, a1, a2, a4, a10 | non | **non** |
| Hyrox | c2 | | c2, a2, a3, a6, a7 | **non** | oui |
| Open Gym | c1 | | c1, c2, a1, a3, a5, a9 | oui | oui |
| Perso a3 | c1 | | a3 | oui | oui |

## Séances

- **Semaine en cours, CrossFit** : copie de la semaine prod Kanda WOD du 28/09/2026 (lundi à vendredi, séance « WOD », publiée à 7h le jour même), donc les jours à venir sont « programmées » :
  - lundi : Squat snatch (EMOM, score charge, 80 %) + Josh (for time, 43/29 kg, variante scaled) ;
  - mardi : Clean and jerk (EMOM, sans score, 75 % du hang clean) + DB DT ladder (AMRAP 20', score reps, sous-bloc « DB DT » 1, 2, 3… rounds) ;
  - mercredi : Renfo fonctionnel (sans score) + Test 2000 m Ski (temps) ;
  - jeudi : Front Squat (EMOM, charge, 75 %) + WOD (3 rounds for time, 80/50 kg) ;
  - vendredi : Renfo pull · Technique HSPU (3 sous-blocs, sans score) + WOD (5 sets, score reps).
- **Challenge de la semaine** (CrossFit, 7 jours, AMRAP 7' score reps) : chaque lundi (semaines -2, -1 et en cours).
- **Samedi** : « Team WOD (brouillon) » dans CrossFit, sans date de publication.
- **Semaines -2 et -1** : CrossFit lundi/mercredi/vendredi, Haltéro mardi, Hyrox jeudi, Open Gym samedi, publiées.
- **Semaine prochaine** (CrossFit) : lundi à mercredi programmées, jeudi et vendredi en brouillon.
- **Aujourd'hui** : « Fran (perso a3) » dans Perso a3.
- **Bibliothèque** : 7 modèles en 4 sections (Benchmark CrossFit, WOD, Hyrox, Haltéro), dont « DB DT ladder ».

Activité générée (pseudo-aléatoire mais identique à chaque lancement) : scores avec commentaires, « Fait » sur les blocs sans score, « Je passe » (~12 % des blocs), réactions (CrossFit uniquement, les 5 visages), records (1RM + Fran), 7 jours de statistiques d'usage avec quelques erreurs.

## Cas à valider

Colonne « Compte » : avec qui se connecter. « Données » : ce qui couvre le cas.

### Profil et comptes

| ID | Cas | Compte | Données / attendu |
|---|---|---|---|
| UC-01 | Connexion email + mot de passe | tout compte | `a` |
| UC-02 | Onboarding demande le genre si absent | n1 | écran d'accueil avec choix Homme / Femme, puis accès à l'app |
| UC-03 | Photo de profil : affichage, changement, suppression | c1, c2, a1, a4 (avec photo), a2 (sans) | initiales quand pas de photo |
| UC-04 | Modifier son pseudo (modale) | tout compte | |
| UC-05 | Changer son genre dans le profil | a2 | passe du classement H au F |

### Programmation (coach)

| ID | Cas | Compte | Données / attendu |
|---|---|---|---|
| UC-06 | Charge femme « 43/29 kg » à la saisie et à l'affichage | c1 ; a1 (F) vs a2 (H) | Josh (lundi), Fran ; l'athlète voit sa charge |
| UC-07 | Saisie de bloc : mouvements déjà utilisés en premier, charges préremplies, dupliquer un mouvement | c1 | éditeur d'une séance CrossFit |
| UC-08 | Type de score choisi par le coach + aperçu | c1 | 5 types présents : temps (Josh), rounds+reps (Cindy), reps (DB DT, challenge), charge (Squat snatch), aucun (Clean and jerk) |
| UC-09 | Sous-blocs avec progression start/step | c1 | DB DT ladder (mardi) : « 1, 2, 3… rounds » ; vendredi : 3 sous-blocs |
| UC-10 | Séance sur plusieurs jours (« Nombre de jours ») | c1 | Challenge de la semaine, 7 jours |
| UC-11 | Duplication multi-séances : même programme +7 j, ou autre programme | c1 | sélectionner lundi-mercredi CrossFit ; mélange CrossFit + Haltéro refusé |
| UC-12 | Mini agenda (date et date+heure) | c1 | éditeur, programmation, publication |
| UC-13 | Brouillon / programmée visible par owner et contributeurs sur l'accueil, fond hachuré, score désactivé | c1, c2 ; a2 (ne voit rien) | mercredi-vendredi (programmées), samedi « Team WOD (brouillon) » |
| UC-14 | Réglages programme : réactions et classement on/off | c1 (Haltéro), c2 (Hyrox) | Haltéro sans classement, Hyrox sans réactions |
| UC-15 | Bibliothèque par sections, planifier un modèle | c1 | 4 sections |

### Accueil et séance (athlète)

| ID | Cas | Compte | Données / attendu |
|---|---|---|---|
| UC-16 | Panneaux de programme teintés de la couleur du badge | a2 | CrossFit + Haltéro le mardi |
| UC-17 | Défilement auto vers le 1er bloc ni scoré ni passé | a5, a9 | blocs restants dans la semaine |
| UC-18 | Challenge affiché chaque jour de sa période, un seul score | a2 | Max wall balls lundi → dimanche |
| UC-19 | Explication du score reps (AMRAP) + compteur de reps (RepCounter) | a2 | DB DT ladder : rounds de sous-bloc + reps en plus |
| UC-20 | Bloc sans score : case « Fait » en un tap | a2 | Clean and jerk (mardi) |
| UC-21 | Bloc sans score : pas de classement, « Voir les commentaires (n) » | a1 | Clean and jerk : « Fait » avec commentaires |
| UC-22 | « Je passe » sur un bloc ; saisir un score l'annule | a2 | blocs déjà passés dans les semaines -1/-2 |
| UC-35 | Saisie du temps au clavier : minutes puis secondes avec dixième optionnel (« 32,4 »), pavé numérique ; saisie invalide (≥ 60 s, 2 décimales) encadrée en rouge ; temps au-delà du cap refusé ; dixième affiché seulement s'il existe (« 7:32,4 ») | a2 | Josh, classement avec quelques temps à dixièmes ; aussi dans Records > benchmark au temps |
| UC-23 | Minuteur : bips en mode silencieux iPhone, reprise après interruption | tout compte | EMOM Squat snatch, AMRAP DB DT |
| UC-24 | Rechargement auto sur nouvelle version + rafraîchissement au retour dans l'app | tout compte | nécessite un nouveau déploiement de preview |

### Classements et social

| ID | Cas | Compte | Données / attendu |
|---|---|---|---|
| UC-25 | Classement de bloc séparé H/F, ordre elite > rx > scaled > foundation, médailles top 3 | a2 | Josh, Squat snatch (lundi) |
| UC-26 | Top 3 par niveau + ma ligne, classement complet en modale avec onglets Hommes/Femmes ouverts sur mon genre | a2 (H), a1 (F) | Josh |
| UC-27 | Classement de la semaine (somme des rangs, bloc non scoré = dernier + 1) + badge LEADER par genre | a2 | semaines -1 et en cours ; Hugo et Léa attendus en tête |
| UC-28 | Classement désactivé : l'athlète ne voit que son score, pas de classement hebdo ; le coach voit tout | a2 vs c1 | Haltéro |
| UC-29 | Réactions à côté du titre : seulement les émojis utilisés + « + » (5 visages), masqué une fois réagi ; tap = liste avec « − » pour retirer la sienne | a2 | CrossFit ; absent sur Hyrox et Haltéro |

### Coach et admin

| ID | Cas | Compte | Données / attendu |
|---|---|---|---|
| UC-30 | Onglet Stats admin : actifs, sessions, temps de chargement par 10 min, pages, erreurs | c1 | 7 jours d'événements, 3 erreurs ; c2 n'a pas l'onglet |
| UC-31 | Communauté : admins > coachs, athlètes par ordre alpha avec point rose/bleu, « + » invite par catégorie | c1 | 13 comptes |
| UC-32 | Communauté, programmes en 3 sections : mes programmes / contributeur / autres (admin) avec owner | c1 (Hyrox dans « autres »), c2 (CrossFit en contributeur) | |
| UC-33 | Fiche membre, compte rendu 7/30 jours par programme (score, niveau, rang, commentaire, réaction, passé, record) | c1 sur Léa, Sarah, Paul (vide) | limité aux programmes où le coach est owner/contributeur : c2 ne voit que CrossFit et Hyrox |
| UC-34 | Records et % de 1RM ; lien « 1RM ? » quand il manque | a3 (sans 1RM) vs a1 | Squat snatch 80 %, Front Squat 75 %, Clean and jerk 75 % du hang clean |

## Relancer

```sh
node scripts/seed-dev.mjs          # staging (défaut)
node scripts/seed-dev.mjs --clean  # supprime seulement le jeu de test
```

Le script refuse de créer des données avec `TARGET=prod` (seul `--clean` y est accepté).
Il supprime aussi les programmes et séances créés à la main par les comptes `*@tkf.test` (ex. programme « tim » de staging).
