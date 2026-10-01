import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    const maxRetries = 5;
    const retryDelayMs = 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Connexion PostgreSQL établie');
        return;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const errMessage = (error as Error).message ?? String(error);
        this.logger.warn(
          `Tentative ${attempt}/${maxRetries} échouée pour connecter PostgreSQL : ${errMessage}`,
        );

        if (isLastAttempt) {
          if (errMessage.includes('tenant/user') || errMessage.includes('not found')) {
            this.logger.error(
              '=== DIAGNOSTIC SUPABASE ===\n' +
                'Erreur "tenant/user not found" détectée.\n' +
                '1. Votre projet Supabase est très probablement EN PAUSE (mise en veille automatique du plan gratuit après 7 jours d\'inactivité). ' +
                'Rendez-vous sur votre dashboard Supabase et cliquez sur "Restore project" / "Unpause".\n' +
                '2. Vérifiez la variable DATABASE_URL : l\'identifiant de projet et l\'hôte de pooler ' +
                '(ex: aws-0-eu-central-1.pooler.supabase.com) doivent correspondre exactement à la région de votre projet Supabase.\n' +
                '3. Si vous utilisez le Transaction Pooler (port 6543), ajoutez ?pgbouncer=true à la fin de DATABASE_URL.\n' +
                '===========================',
            );
          }
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
