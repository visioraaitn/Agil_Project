import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:public';

/** Ouvre une route sans authentification (login, refresh, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
