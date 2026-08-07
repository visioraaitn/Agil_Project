import { SetMetadata } from '@nestjs/common';
import { Permission } from '@visiora/shared';

export const PERMISSION_KEY = 'rbac:permission';

/**
 * Exige une permission de la matrice partagée (A.2).
 *
 * Sur une route contenant `:projectId`, le rôle de l'utilisateur SUR CE PROJET
 * est résolu en base à chaque requête, puis confronté à la matrice. Aucun test
 * de rôle en dur (`role === 'PRODUCT_OWNER'`) ne doit exister ailleurs : la
 * matrice est la seule autorité.
 *
 *   @RequirePermission('pr:approve')
 *   @Post(':projectId/pull-requests/:id/approve')
 */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);
