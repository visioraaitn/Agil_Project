-- Les anciennes creations etaient inserees en tete. Recompose le backlog dans
-- l'ordre naturel 1, 2, 3 au sein de chaque groupe de freres.
WITH ordered AS (
  SELECT
    "id",
    LPAD(
      ROW_NUMBER() OVER (
        PARTITION BY "projectId", "parentId"
        ORDER BY
          CASE "type"
            WHEN 'EPIC' THEN 0
            WHEN 'STORY' THEN 1
            WHEN 'BUG' THEN 2
            ELSE 3
          END,
          "number",
          "createdAt",
          "id"
      )::TEXT,
      12,
      '0'
    ) AS "newRank"
  FROM "WorkItem"
  WHERE "deletedAt" IS NULL
)
UPDATE "WorkItem" AS item
SET "rank" = ordered."newRank"
FROM ordered
WHERE item."id" = ordered."id";
