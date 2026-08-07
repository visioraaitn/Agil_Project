/**
 * Jeu de données de démonstration.
 *   pnpm db:seed
 *
 * Idempotent : relançable sans dupliquer (upsert sur les clés naturelles).
 * Mot de passe commun à tous les comptes de démo : Visiora2026!
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Visiora2026!';

/** Rangs successifs — même algorithme que packages/shared/src/lexorank.ts. */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
function rankAt(index: number): string {
  const first = ALPHABET[Math.floor(ALPHABET.length / 2)];
  return `${first}${index.toString(36).padStart(4, '0')}`;
}

async function main(): Promise<void> {
  console.log('Seed — démarrage');

  const passwordHash = hashSync(DEMO_PASSWORD, 10);

  // --- Utilisateurs (A.1) -------------------------------------------------
  const [admin, po, scrumMaster, dev1, dev2] = await Promise.all(
    [
      { email: 'admin@visiora.ai', name: 'Yassine Affes', jobTitle: 'CTO', globalRole: 'ADMIN' },
      { email: 'po@visiora.ai', name: 'Amel Ben Salah', jobTitle: 'Product Owner' },
      { email: 'sm@visiora.ai', name: 'Karim Trabelsi', jobTitle: 'Scrum Master' },
      { email: 'dev1@visiora.ai', name: 'Nour Hamdi', jobTitle: 'Développeuse fullstack' },
      { email: 'dev2@visiora.ai', name: 'Mehdi Gharbi', jobTitle: 'Développeur backend' },
    ].map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          email: user.email,
          name: user.name,
          jobTitle: user.jobTitle,
          globalRole: (user.globalRole as 'ADMIN' | 'MEMBER') ?? 'MEMBER',
          passwordHash,
        },
      }),
    ),
  );

  // --- Projet (B.1) -------------------------------------------------------
  const project = await prisma.project.upsert({
    where: { key: 'VIS' },
    update: {},
    create: {
      key: 'VIS',
      name: 'Plateforme Agile VisioraAI',
      description: "Outil interne de gestion de projets agile inspiré d'Azure DevOps.",
      company: 'VisioraAI',
      startDate: new Date('2026-08-01'),
      color: '#0078D4',
      createdById: admin.id,
    },
  });

  await Promise.all(
    [
      { userId: po.id, role: 'PRODUCT_OWNER' as const, capacity: 5 },
      { userId: scrumMaster.id, role: 'SCRUM_MASTER' as const, capacity: 8 },
      { userId: dev1.id, role: 'DEVELOPER' as const, capacity: 21 },
      { userId: dev2.id, role: 'DEVELOPER' as const, capacity: 21 },
    ].map((member) =>
      prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: member.userId } },
        update: { role: member.role },
        create: { projectId: project.id, ...member },
      }),
    ),
  );

  // --- Labels (C.2) -------------------------------------------------------
  const labelDefs = [
    { name: 'bug', color: '#D13438' },
    { name: 'amélioration', color: '#107C10' },
    { name: 'technique', color: '#605E5C' },
    { name: 'urgent', color: '#CA5010' },
  ];
  const labels = await Promise.all(
    labelDefs.map((label) =>
      prisma.label.upsert({
        where: { projectId_name: { projectId: project.id, name: label.name } },
        update: { color: label.color },
        create: { projectId: project.id, ...label },
      }),
    ),
  );

  // --- Dépôt Git externe + branches (périmètre technique) -----------------
  const repository = await prisma.repository.upsert({
    where: { projectId_name: { projectId: project.id, name: 'visiora-agile' } },
    update: {},
    create: {
      projectId: project.id,
      name: 'visiora-agile',
      provider: 'GITHUB',
      url: 'https://github.com/visiora-ai/visiora-agile',
      defaultBranch: 'main',
    },
  });

  for (const branchName of ['main', 'develop', 'feature/board-kanban']) {
    await prisma.branch.upsert({
      where: { repositoryId_name: { repositoryId: repository.id, name: branchName } },
      update: {},
      create: { repositoryId: repository.id, name: branchName },
    });
  }

  // --- Sprint (C.3) -------------------------------------------------------
  const existingSprint = await prisma.sprint.findFirst({
    where: { projectId: project.id, name: 'Sprint 1' },
  });
  const sprint =
    existingSprint ??
    (await prisma.sprint.create({
      data: {
        projectId: project.id,
        name: 'Sprint 1',
        goal: 'Livrer le socle : authentification, projets et backlog navigable.',
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-24'),
        status: 'ACTIVE',
      },
    }));

  // --- Backlog : Epics > Stories > Sous-tâches (C.1, D.3) -----------------
  const alreadySeeded = await prisma.workItem.count({ where: { projectId: project.id } });
  if (alreadySeeded > 0) {
    console.log(`Seed — backlog déjà présent (${alreadySeeded} tickets), création ignorée`);
    console.log('Seed — terminé');
    return;
  }

  let counter = 0;
  const nextNumber = (): number => (counter += 1);

  const createItem = (
    data: Omit<Prisma.WorkItemUncheckedCreateInput, 'projectId' | 'number' | 'rank'> & {
      rankIndex: number;
    },
  ) => {
    const { rankIndex, ...rest } = data;
    return prisma.workItem.create({
      data: {
        ...rest,
        projectId: project.id,
        number: nextNumber(),
        rank: rankAt(rankIndex),
      },
    });
  };

  const epicAccess = await createItem({
    type: 'EPIC',
    title: 'Gestion des accès et des rôles',
    description: "Authentification, comptes utilisateurs et permissions par projet.",
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    reporterId: po.id,
    rankIndex: 0,
    startDate: new Date('2026-08-10'),
    dueDate: new Date('2026-08-31'),
  });

  const epicBacklog = await createItem({
    type: 'EPIC',
    title: 'Backlog et Task Board',
    description: 'Epics, user stories, priorisation et tableau Kanban.',
    priority: 'HIGH',
    reporterId: po.id,
    rankIndex: 1,
    startDate: new Date('2026-08-24'),
    dueDate: new Date('2026-09-21'),
  });

  const storyLogin = await createItem({
    type: 'STORY',
    title: 'En tant qu’utilisateur, je me connecte avec mon email et mon mot de passe',
    description:
      "L'utilisateur saisit son email et son mot de passe. En cas de succès il arrive sur la vue portefeuille.",
    technicalNotes: 'JWT court + refresh token en cookie httpOnly, rotation à chaque rafraîchissement.',
    status: 'IN_TEST',
    priority: 'CRITICAL',
    storyPoints: 5,
    parentId: epicAccess.id,
    sprintId: sprint.id,
    assigneeId: dev1.id,
    reporterId: po.id,
    rankIndex: 2,
  });

  await prisma.acceptanceCriterion.createMany({
    data: [
      { workItemId: storyLogin.id, content: 'Un compte désactivé ne peut pas se connecter', position: 0, isMet: true },
      { workItemId: storyLogin.id, content: 'Message d’erreur générique en cas d’identifiants invalides', position: 1, isMet: true },
      { workItemId: storyLogin.id, content: 'La session survit à un rafraîchissement de la page', position: 2 },
    ],
  });

  await prisma.workItem.create({
    data: {
      projectId: project.id,
      number: nextNumber(),
      rank: rankAt(3),
      type: 'SUBTASK',
      title: 'Écran de connexion (React + validation Zod)',
      status: 'DONE',
      storyPoints: 2,
      parentId: storyLogin.id,
      sprintId: sprint.id,
      assigneeId: dev1.id,
      reporterId: dev1.id,
      closedAt: new Date(),
    },
  });

  await prisma.workItem.create({
    data: {
      projectId: project.id,
      number: nextNumber(),
      rank: rankAt(4),
      type: 'SUBTASK',
      title: 'Endpoint POST /auth/login + rotation du refresh token',
      status: 'IN_PROGRESS',
      storyPoints: 3,
      parentId: storyLogin.id,
      sprintId: sprint.id,
      assigneeId: dev2.id,
      reporterId: dev1.id,
    },
  });

  const storyRoles = await createItem({
    type: 'STORY',
    title: 'En tant qu’administrateur, j’attribue un rôle différent par projet',
    description: 'Un même utilisateur peut être Product Owner sur un projet et développeur sur un autre.',
    status: 'READY_FOR_APPROVAL',
    priority: 'HIGH',
    storyPoints: 8,
    parentId: epicAccess.id,
    sprintId: sprint.id,
    assigneeId: dev2.id,
    reporterId: po.id,
    rankIndex: 5,
  });

  const storyBoard = await createItem({
    type: 'STORY',
    title: 'En tant que développeur, je déplace une tâche entre les colonnes du board',
    description: 'Glisser-déposer entre À faire, En cours, En test, Prêt pour approbation et Terminé.',
    priority: 'MEDIUM',
    storyPoints: 13,
    parentId: epicBacklog.id,
    reporterId: po.id,
    rankIndex: 6,
  });

  const bug = await createItem({
    type: 'BUG',
    title: 'Le filtre par sprint ne conserve pas la sélection après rechargement',
    status: 'TODO',
    priority: 'MEDIUM',
    storyPoints: 2,
    isBlocked: true,
    blockedReason: 'En attente de la décision sur la persistance des filtres (URL ou profil)',
    sprintId: sprint.id,
    assigneeId: dev1.id,
    reporterId: scrumMaster.id,
    rankIndex: 7,
  });

  const labelBug = labels.find((label) => label.name === 'bug');
  const labelUrgent = labels.find((label) => label.name === 'urgent');
  if (labelBug && labelUrgent) {
    await prisma.workItemLabel.createMany({
      data: [
        { workItemId: bug.id, labelId: labelBug.id },
        { workItemId: bug.id, labelId: labelUrgent.id },
        { workItemId: storyBoard.id, labelId: labelUrgent.id },
      ],
      skipDuplicates: true,
    });
  }

  // --- Pull request (E.1) -------------------------------------------------
  const featureBranch = await prisma.branch.findUniqueOrThrow({
    where: { repositoryId_name: { repositoryId: repository.id, name: 'feature/board-kanban' } },
  });
  const mainBranch = await prisma.branch.findUniqueOrThrow({
    where: { repositoryId_name: { repositoryId: repository.id, name: 'main' } },
  });

  const pullRequest = await prisma.pullRequest.create({
    data: {
      workItemId: storyRoles.id,
      repositoryId: repository.id,
      title: 'feat(auth): rôle par projet',
      externalNumber: 42,
      externalUrl: 'https://github.com/visiora-ai/visiora-agile/pull/42',
      status: 'READY_FOR_APPROVAL',
      sourceBranchId: featureBranch.id,
      targetBranchId: mainBranch.id,
      declaredById: dev2.id,
    },
  });

  await prisma.pullRequestEvent.createMany({
    data: [
      { pullRequestId: pullRequest.id, actorId: dev2.id, toStatus: 'OPEN', comment: 'PR déclarée' },
      {
        pullRequestId: pullRequest.id,
        actorId: dev2.id,
        fromStatus: 'OPEN',
        toStatus: 'READY_FOR_APPROVAL',
        comment: 'Prête pour relecture du PO',
      },
    ],
  });

  // --- Rétrospective & jalon ---------------------------------------------
  await prisma.retrospectiveItem.createMany({
    data: [
      { sprintId: sprint.id, category: 'WENT_WELL', content: 'Mise en place rapide du socle technique', authorId: scrumMaster.id },
      { sprintId: sprint.id, category: 'TO_IMPROVE', content: 'Les stories arrivent trop tard en test', authorId: dev1.id },
      { sprintId: sprint.id, category: 'ACTION_ITEM', content: 'Découper les stories à plus de 8 points', authorId: scrumMaster.id },
    ],
  });

  await prisma.milestone.create({
    data: {
      projectId: project.id,
      name: 'Livraison MVP interne',
      description: 'Auth + projets + backlog + board utilisables par l’équipe.',
      date: new Date('2026-09-15'),
    },
  });

  await prisma.comment.create({
    data: {
      workItemId: storyLogin.id,
      authorId: po.id,
      body: 'Peut-on prévoir un message spécifique pour les comptes désactivés ? @Nour Hamdi',
      mentionedUserIds: [dev1.id],
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { lastItemNumber: counter },
  });

  console.log(`Seed — terminé : ${counter} tickets, 5 utilisateurs, 1 projet, 1 sprint`);
  console.log(`Comptes de démo — mot de passe : ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Seed — échec', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
