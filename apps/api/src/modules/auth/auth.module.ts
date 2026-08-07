import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { IDENTITY_PROVIDERS, IdentityProvider } from './identity/identity-provider';
import { LocalIdentityProvider } from './identity/local-identity.provider';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    LocalIdentityProvider,
    {
      // Registre des fournisseurs d'identité actifs.
      // Ajouter le SSO Entra = écrire le provider et l'ajouter à cette liste.
      provide: IDENTITY_PROVIDERS,
      useFactory: (local: LocalIdentityProvider): IdentityProvider[] => [local],
      inject: [LocalIdentityProvider],
    },
  ],
  exports: [TokenService, AuthService],
})
export class AuthModule {}
