-- D.1 · Rang dédié à l'ordre des cartes dans les colonnes du board.
-- Distinct de `rank` (ordre du backlog) : réordonner une carte sur le board ne
-- doit pas modifier la priorisation du backlog.
--
-- Les tickets existants héritent de leur rang de backlog comme position initiale,
-- ce qui préserve l'ordre affiché au moment de la migration.

ALTER TABLE "WorkItem" ADD COLUMN "boardRank" TEXT;

UPDATE "WorkItem" SET "boardRank" = "rank" WHERE "boardRank" IS NULL;

ALTER TABLE "WorkItem" ALTER COLUMN "boardRank" SET NOT NULL;

-- CreateIndex
CREATE INDEX "WorkItem_projectId_status_boardRank_idx" ON "WorkItem"("projectId", "status", "boardRank");
