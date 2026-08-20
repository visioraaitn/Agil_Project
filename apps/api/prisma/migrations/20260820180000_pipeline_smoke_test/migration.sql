-- Migration technique sans effet métier.
-- Elle permet de vérifier que GitHub Actions exécute bien `prisma migrate deploy`
-- lorsqu'un fichier sous prisma/migrations change.
SELECT 1;
