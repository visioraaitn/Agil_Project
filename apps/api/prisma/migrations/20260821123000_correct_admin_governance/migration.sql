-- Product Owner est une fonction professionnelle, pas un rôle global.
-- Le privilège de gestion des administrateurs reste interne et non modifiable par l'API.
ALTER TABLE "User"
ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Les comptes promus par la migration précédente redeviennent des administrateurs.
UPDATE "User"
SET "globalRole" = 'ADMIN'
WHERE "globalRole" = 'PRODUCT_OWNER';

-- Compte de gouvernance demandé : ADMIN, fonction Product Owner, super administrateur.
UPDATE "User"
SET
  "globalRole" = 'ADMIN',
  "jobTitle" = 'PRODUCT_OWNER',
  "isSuperAdmin" = true
WHERE lower("email") = 'kenounheni4@gmail.com'
  AND "deletedAt" IS NULL;

-- Retire PRODUCT_OWNER de l'enum global après conversion de toutes les lignes.
ALTER TABLE "User" ALTER COLUMN "globalRole" DROP DEFAULT;
ALTER TYPE "GlobalRole" RENAME TO "GlobalRole_old";
CREATE TYPE "GlobalRole" AS ENUM ('ADMIN', 'MEMBER');
ALTER TABLE "User"
ALTER COLUMN "globalRole" TYPE "GlobalRole"
USING ("globalRole"::text::"GlobalRole");
ALTER TABLE "User" ALTER COLUMN "globalRole" SET DEFAULT 'MEMBER';
DROP TYPE "GlobalRole_old";
