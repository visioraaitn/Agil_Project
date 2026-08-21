/**
 * Seed de production : crée uniquement l'administrateur système si absent.
 * Il ne remplit ni le portefeuille ni les données de démonstration.
 */
import { PrismaClient, GlobalRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();
const ADMIN_SEED_EMAIL = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
const ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
const PASSWORD_SALT_ROUNDS = 10;

async function ensureAdminSeed(): Promise<void> {
  if (!ADMIN_SEED_EMAIL || !ADMIN_SEED_PASSWORD) {
    throw new Error(
      'ADMIN_SEED_EMAIL et ADMIN_SEED_PASSWORD doivent être définis pour lancer le seed Prisma.',
    );
  }

  const passwordHash = hashSync(ADMIN_SEED_PASSWORD, PASSWORD_SALT_ROUNDS);

  await prisma.user.upsert({
    where: { email: ADMIN_SEED_EMAIL },
    update: {
      name: 'Product Owner',
      jobTitle: 'PRODUCT_OWNER',
      globalRole: GlobalRole.PRODUCT_OWNER,
      passwordHash,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: ADMIN_SEED_EMAIL,
      name: 'Product Owner',
      jobTitle: 'PRODUCT_OWNER',
      passwordHash,
      globalRole: GlobalRole.PRODUCT_OWNER,
      isActive: true,
    },
  });

  console.log(`✅ Admin Prisma prêt : ${ADMIN_SEED_EMAIL}`);
}

async function main(): Promise<void> {
  await ensureAdminSeed();
}

main()
  .catch((error) => {
    console.error('❌ Échec du seed admin :', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
