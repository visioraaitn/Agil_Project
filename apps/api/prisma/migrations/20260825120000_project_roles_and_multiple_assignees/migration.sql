-- ProjectRole describes access inside a project. Professional functions such
-- as Product Owner remain stored on User.jobTitle and never grant permissions.
CREATE TYPE "ProjectRole_new" AS ENUM ('PROJECT_LEAD', 'MEMBER');

ALTER TABLE "ProjectMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "ProjectMember"
  ALTER COLUMN "role" TYPE "ProjectRole_new"
  USING (
    CASE
      WHEN "role"::text IN ('PRODUCT_OWNER', 'SCRUM_MASTER') THEN 'PROJECT_LEAD'
      ELSE 'MEMBER'
    END
  )::"ProjectRole_new";

ALTER TYPE "ProjectRole" RENAME TO "ProjectRole_old";
ALTER TYPE "ProjectRole_new" RENAME TO "ProjectRole";
DROP TYPE "ProjectRole_old";
ALTER TABLE "ProjectMember" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- Multiple assignees per work item. Existing single assignments are preserved.
CREATE TABLE "WorkItemAssignee" (
  "workItemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkItemAssignee_pkey" PRIMARY KEY ("workItemId", "userId")
);

CREATE INDEX "WorkItemAssignee_userId_idx" ON "WorkItemAssignee"("userId");

ALTER TABLE "WorkItemAssignee"
  ADD CONSTRAINT "WorkItemAssignee_workItemId_fkey"
  FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemAssignee"
  ADD CONSTRAINT "WorkItemAssignee_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WorkItemAssignee" ("workItemId", "userId")
SELECT "id", "assigneeId"
FROM "WorkItem"
WHERE "assigneeId" IS NOT NULL
ON CONFLICT DO NOTHING;
