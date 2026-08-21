-- Product Owner plateforme : seul rôle autorisé à gouverner les comptes.
ALTER TYPE "GlobalRole" ADD VALUE IF NOT EXISTS 'PRODUCT_OWNER';

-- Notification visible lors de la première connexion d'un nouveau compte.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCOUNT_CREATED';
