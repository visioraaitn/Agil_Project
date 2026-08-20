-- Synchronise les fonctionnalités Pull Request déjà présentes dans schema.prisma.
-- Le backfill des numéros reste sûr si la base contient déjà plusieurs PR par dépôt.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PR_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'PR_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'PR_MERGED';
ALTER TYPE "NotificationType" ADD VALUE 'PR_CLOSED';
ALTER TYPE "NotificationType" ADD VALUE 'PR_COMMENTED';

-- AlterEnum
ALTER TYPE "PullRequestStatus" ADD VALUE 'REJECTED';

-- DropIndex
DROP INDEX "PullRequest_status_idx";

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Repository"
ADD COLUMN "description" TEXT,
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastPrNumber" INTEGER NOT NULL DEFAULT 0;

-- Le numéro est d'abord nullable pour permettre un backfill sans collision.
ALTER TABLE "PullRequest"
ADD COLUMN "description" TEXT,
ADD COLUMN "mergedAt" TIMESTAMP(3),
ADD COLUMN "mergedById" TEXT,
ADD COLUMN "number" INTEGER,
ADD COLUMN "rejectionReason" TEXT;

WITH ranked_pull_requests AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "repositoryId"
      ORDER BY "createdAt", "id"
    )::INTEGER AS "number"
  FROM "PullRequest"
)
UPDATE "PullRequest" AS pull_request
SET "number" = ranked_pull_requests."number"
FROM ranked_pull_requests
WHERE pull_request."id" = ranked_pull_requests."id";

ALTER TABLE "PullRequest"
ALTER COLUMN "number" SET DEFAULT 1,
ALTER COLUMN "number" SET NOT NULL;

UPDATE "Repository" AS repository
SET "lastPrNumber" = pull_request_numbers."lastPrNumber"
FROM (
  SELECT "repositoryId", MAX("number") AS "lastPrNumber"
  FROM "PullRequest"
  GROUP BY "repositoryId"
) AS pull_request_numbers
WHERE repository."id" = pull_request_numbers."repositoryId";

-- CreateTable
CREATE TABLE "PullRequestComment" (
    "id" TEXT NOT NULL,
    "pullRequestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PullRequestComment_pullRequestId_createdAt_idx" ON "PullRequestComment"("pullRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "PullRequest_repositoryId_status_idx" ON "PullRequest"("repositoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_repositoryId_number_key" ON "PullRequest"("repositoryId", "number");

-- AddForeignKey
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequestComment" ADD CONSTRAINT "PullRequestComment_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequestComment" ADD CONSTRAINT "PullRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
