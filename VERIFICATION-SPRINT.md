# Numérotation selon la position — 5 octobre 2026

Ce rapport remplace le précédent : l'utilisateur a explicitement demandé que les numéros suivent désormais la position et soient recalculés après suppression. L'ancienne règle de conservation des numéros ne s'applique plus.

## Comportement livré

- Glisser-déposer dans le backlog : renumérotation des frères du même type selon `rank`.
- Suppression : suppression logique du ticket et de sa descendance, puis numérotation consécutive des frères restants.
- Création : normalisation de la liste, puis numéro suivant en fin de liste. L'import utilise le même service.
- Changement de parent : renumérotation des deux groupes concernés.
- UUID internes conservés ; relations, commentaires et pièces jointes restent attachés aux mêmes tickets.
- Références affichées des descendants recalculées à partir des numéros de leurs parents.
- Les autres filtres de tri et les changements de statut sur le board ne modifient pas l'ordre manuel du backlog.

La renumérotation et la mutation se font dans une même transaction sérialisable avec rejeu des conflits. Des numéros temporaires négatifs, invisibles hors transaction, évitent les collisions lors des échanges sous les index uniques existants. Aucune migration ni suppression de base n'est nécessaire.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| Suppression du 2 dans 1–2–3–4 : les restants deviennent 1–2–3 | PASS — API réelle + PostgreSQL |
| Création suivante : numéro 4, UUID des autres tickets conservés | PASS — API + PostgreSQL |
| Référence de la sous-tâche d'un parent renuméroté | PASS — API |
| Reorder API : numéro suivant la position | PASS |
| Glisser-déposer au clavier dans Chrome | PASS |
| Référence descendante correcte après refresh navigateur | PASS |
| Propagation Epic → Sprint, conflit, annulation et confirmation | PASS |
| Clôture vers autre sprint et vers backlog | PASS |
| Seed labels idempotent | PASS |
| Tests API | 132 PASS, 19 suites |
| Tests shared | 41 PASS |
| Tests frontend | 6 PASS |
| Tests de bout en bout ciblés | 2 PASS, 13 secondes |
| Typecheck, lint, git diff --check | PASS |
| Build backend et frontend | PASS |

Projets des derniers tests : `NMUVNAFCX` et `TMUVNAG6S`. Ils sont conservés pour inspection.

## Alignement des données existantes

Le script `apps/api/prisma/renumber-work-items.ts` a été exécuté après les tests. Il aligne les numéros sur l'ordre existant, sans changer les rangs ni les liens.

- 72 tickets actifs contrôlés, 29 groupes.
- 27 numéros corrigés.
- Comparaison avec sauvegarde : UUID, projet, parent, type et rank préservés.
- Requête PostgreSQL avec ROW_NUMBER : zéro numéro différent de sa position dans son groupe.
- Sauvegarde préalable : `backups/work-item-numbers-1791228670924.json`.

État LEG constaté après alignement, sous l'Epic mmm :

| Numéro | Titre |
| --- | --- |
| LEG-1-1 | jecojnovondq |
| LEG-1-2 | smmx,x,x |
| LEG-1-3 | pxpfpee |

L'ordre est celui des ranks présents au moment de l'alignement. L'API reconstruite a été redémarrée sur le port configuré 3010 ; le frontend reste sur 5173.

## Fichiers de cette modification

- `apps/api/src/modules/work-items/work-item-numbering.ts` : renumérotation partagée.
- `apps/api/src/modules/work-items/work-items.service.ts` : transactions de création, déplacement, rattachement et suppression.
- `apps/api/src/modules/work-items/work-items.service.spec.ts` : nouvelle règle de reorder.
- `apps/api/src/modules/work-items/renumber-siblings.spec.ts` : échanges sous contrainte d'unicité et idempotence.
- `apps/api/prisma/renumber-work-items.ts` : alignement des données et sauvegarde.
- `apps/web/tests/e2e/sprint-propagation.spec.ts` : scénarios API, DB et navigateur adaptés à la nouvelle règle.
- `VERIFICATION-SPRINT.md` : rapport actualisé.

Les corrections Epic/Sprint, labels et session de la reprise précédente sont conservées. Le frontend utilise déjà les UUID pour identifier les lignes et invalide les lectures du projet après mutation ; aucun numéro n'est calculé artificiellement dans React.

## Limites

Avertissement Vite non bloquant sur la taille du bundle frontend (~1,62 Mo avant gzip). Le seed de démonstration destructif n'a pas été lancé. Les tests intensifs utilisent un plafond de requêtes relevé uniquement pour leur processus API ; la configuration locale reste inchangée.
