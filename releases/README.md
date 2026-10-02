# Notes de version

Chaque version de production a son fichier `v<majeur>.<mineur>.<correctif>.json` : nouveautés très haut niveau,
en trois catégories (`admin` = technique, `coach`, `athlete`), une phrase par nouveauté.

- **Chaque PR de feature** ajoute un fichier `next-update/<nom-de-la-feature>.json` (un fichier par PR, pour que deux
  PR en parallèle n'entrent pas en conflit) :

  ```json
  { "coach": ["Les WODs peuvent se faire en équipe"], "athlete": ["Score d'équipe saisi par un seul équipier"] }
  ```

  Catégories vides omises. Une PR purement technique sans effet visible peut n'avoir que `admin`.
- **Avant une release**, `node scripts/release.mjs <mineur|correctif|majeur>` sur une branche partie de `staging`
  rassemble ces fichiers dans `v<version>.json`, vide `next-update/` et monte la version de `package.json`.
- **Au merge dans `main`**, le tag `v<version>` et la release GitHub sont créés automatiquement.

Numérotation : `majeur` pour une refonte ou un changement qui casse des habitudes, `mineur` pour une release de
nouveautés, `correctif` pour une release de corrections seulement (dont les correctifs urgents).
