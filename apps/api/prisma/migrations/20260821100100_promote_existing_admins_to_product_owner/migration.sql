-- Préserve l'accès à la gestion des comptes lors de l'introduction du rôle
-- Product Owner. Les futurs administrateurs restent limités aux fonctions
-- techniques et projet.
UPDATE "User"
SET "globalRole" = 'PRODUCT_OWNER'
WHERE "globalRole" = 'ADMIN';
