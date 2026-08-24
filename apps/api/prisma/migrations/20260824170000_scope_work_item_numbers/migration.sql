-- Les anciens numeros etaient uniques a l'echelle du projet. Ils deviennent
-- locaux au type et au parent afin d'obtenir VIS-1, VIS-1-1, VIS-1-2, etc.
DROP INDEX IF EXISTS "WorkItem_projectId_number_key";

-- Renumerote uniquement les tickets actifs. Les tickets supprimes conservent
-- leur historique et ne reservent plus leur ancien numero.
WITH numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId", "parentId", "type"
      ORDER BY "createdAt", "id"
    )::INTEGER AS "newNumber"
  FROM "WorkItem"
  WHERE "deletedAt" IS NULL
)
UPDATE "WorkItem" AS item
SET "number" = numbered."newNumber"
FROM numbered
WHERE item."id" = numbered."id";

-- L'unicite porte uniquement sur les tickets actifs. Une suppression logique
-- libere donc bien le numero pour la prochaine creation.
CREATE UNIQUE INDEX "WorkItem_active_root_number_key"
ON "WorkItem" ("projectId", "type", "number")
WHERE "deletedAt" IS NULL AND "parentId" IS NULL;

CREATE UNIQUE INDEX "WorkItem_active_child_number_key"
ON "WorkItem" ("projectId", "parentId", "type", "number")
WHERE "deletedAt" IS NULL AND "parentId" IS NOT NULL;

CREATE INDEX "WorkItem_projectId_parentId_type_number_idx"
ON "WorkItem" ("projectId", "parentId", "type", "number");
