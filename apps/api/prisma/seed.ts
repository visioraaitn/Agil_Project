/**
 * Jeu de données de démonstration complet pour la plateforme VisioraAI Agile.
 * Exécuter avec : pnpm db:seed (ou pnpm db:reset)
 *
 * Mot de passe commun à tous les comptes de démo : Visiora2026!
 */
import { PrismaClient, Prisma, GlobalRole, ProjectRole, ProjectStatus, SprintStatus, WorkItemStatus, Priority, WorkItemType, GitProvider, PullRequestStatus, RetroCategory, NotificationType, EntityType } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Visiora2026!';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
function rankAt(index: number): string {
  const first = ALPHABET[Math.floor(ALPHABET.length / 2)];
  return `${first}${index.toString(36).padStart(4, '0')}`;
}

async function main(): Promise<void> {
  console.log('🌱 Alimentation complète de la base de données VisioraAI Agile...');

  const passwordHash = hashSync(DEMO_PASSWORD, 10);

  // --- Nettoyage préventif des données pour un seed complet et propre ---
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.pullRequestEvent.deleteMany();
  await prisma.pullRequest.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.retrospectiveItem.deleteMany();
  await prisma.sprintSnapshot.deleteMany();
  await prisma.acceptanceCriterion.deleteMany();
  await prisma.workItemLabel.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.label.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.session.deleteMany();
  await prisma.project.deleteMany();

  // =========================================================================
  // 1. UTILISATEURS (Comptes avec rôles et profils réalistes)
  // =========================================================================
  const usersData = [
    {
      email: 'admin@visiora.ai',
      name: 'Yassine Affes',
      jobTitle: 'CTO & Co-fondateur',
      globalRole: GlobalRole.ADMIN,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    {
      email: 'po@visiora.ai',
      name: 'Amel Ben Salah',
      jobTitle: 'Lead Product Owner',
      globalRole: GlobalRole.MEMBER,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    },
    {
      email: 'sm@visiora.ai',
      name: 'Karim Trabelsi',
      jobTitle: 'Senior Scrum Master',
      globalRole: GlobalRole.MEMBER,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
    {
      email: 'dev1@visiora.ai',
      name: 'Nour Hamdi',
      jobTitle: 'Ingénieure Fullstack React / Node',
      globalRole: GlobalRole.MEMBER,
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    },
    {
      email: 'dev2@visiora.ai',
      name: 'Mehdi Gharbi',
      jobTitle: 'Architecte Backend & DevOps',
      globalRole: GlobalRole.MEMBER,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    },
    {
      email: 'viewer@visiora.ai',
      name: 'Sonia Cherif',
      jobTitle: 'Directrice de Projet Client (Observateur)',
      globalRole: GlobalRole.MEMBER,
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    },
  ];

  const users: Record<string, any> = {};
  for (const u of usersData) {
    users[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        jobTitle: u.jobTitle,
        globalRole: u.globalRole,
        avatarUrl: u.avatarUrl,
        passwordHash,
        isActive: true,
        deletedAt: null,
      },
      create: {
        email: u.email,
        name: u.name,
        jobTitle: u.jobTitle,
        globalRole: u.globalRole,
        avatarUrl: u.avatarUrl,
        passwordHash,
        isActive: true,
      },
    });
  }

  console.log(`✅ ${Object.keys(users).length} utilisateurs configurés`);

  // =========================================================================
  // 2. PROJETS (Portefeuille multi-projets)
  // =========================================================================
  const pVis = await prisma.project.create({
    data: {
      key: 'VIS',
      name: 'Plateforme Agile VisioraAI',
      description: "Outil interne de gestion de projets agile inspiré d'Azure DevOps (Backlog, Kanban, Sprints, Git PR).",
      company: 'VisioraAI',
      status: ProjectStatus.ACTIVE,
      startDate: new Date('2026-08-01'),
      targetDate: new Date('2026-11-30'),
      color: '#0078D4', // Bleu Azure
      createdById: users['admin@visiora.ai'].id,
    },
  });

  const pEcom = await prisma.project.create({
    data: {
      key: 'ECOM',
      name: 'Portail E-Commerce B2B Omnicanal',
      description: 'Refonte de la marketplace B2B avec catalogue produits en temps réel et intégration ERP SAP.',
      company: 'Retail Global Corp',
      status: ProjectStatus.ACTIVE,
      startDate: new Date('2026-07-15'),
      targetDate: new Date('2026-12-15'),
      color: '#8764B8', // Violet
      createdById: users['admin@visiora.ai'].id,
    },
  });

  const pAI = await prisma.project.create({
    data: {
      key: 'AI',
      name: 'Assistant IA & Analyse Documentaire',
      description: 'Microservice RAG et classification sémantique de contrats par modèles LLM et vision.',
      company: 'VisioraAI Labs',
      status: ProjectStatus.ON_HOLD,
      startDate: new Date('2026-06-01'),
      targetDate: new Date('2026-10-31'),
      color: '#107C10', // Vert
      createdById: users['admin@visiora.ai'].id,
    },
  });

  const pOld = await prisma.project.create({
    data: {
      key: 'LEG',
      name: 'Migration Legacy Monolithe PHP',
      description: 'Décommissionnement de l’ancien CRM et archivage des données historiques.',
      company: 'VisioraAI Interne',
      status: ProjectStatus.COMPLETED,
      startDate: new Date('2026-01-10'),
      targetDate: new Date('2026-07-30'),
      color: '#605E5C', // Gris
      createdById: users['admin@visiora.ai'].id,
    },
  });

  // =========================================================================
  // 3. MEMBRES ET RÔLES PAR PROJET (RBAC)
  // =========================================================================
  const members = [
    // Projet VIS
    { project: pVis, user: users['po@visiora.ai'], role: ProjectRole.PRODUCT_OWNER, capacity: 5 },
    { project: pVis, user: users['sm@visiora.ai'], role: ProjectRole.SCRUM_MASTER, capacity: 8 },
    { project: pVis, user: users['dev1@visiora.ai'], role: ProjectRole.DEVELOPER, capacity: 21 },
    { project: pVis, user: users['dev2@visiora.ai'], role: ProjectRole.DEVELOPER, capacity: 21 },
    { project: pVis, user: users['viewer@visiora.ai'], role: ProjectRole.VIEWER, capacity: null },
    // Projet ECOM
    { project: pEcom, user: users['admin@visiora.ai'], role: ProjectRole.PRODUCT_OWNER, capacity: 10 },
    { project: pEcom, user: users['sm@visiora.ai'], role: ProjectRole.SCRUM_MASTER, capacity: 8 },
    { project: pEcom, user: users['dev1@visiora.ai'], role: ProjectRole.DEVELOPER, capacity: 13 },
    // Projet AI
    { project: pAI, user: users['po@visiora.ai'], role: ProjectRole.PRODUCT_OWNER, capacity: 5 },
    { project: pAI, user: users['dev2@visiora.ai'], role: ProjectRole.DEVELOPER, capacity: 21 },
  ];

  for (const m of members) {
    await prisma.projectMember.create({
      data: {
        projectId: m.project.id,
        userId: m.user.id,
        role: m.role,
        capacity: m.capacity,
      },
    });
  }

  // =========================================================================
  // 4. ÉTIQUETTES (Labels par projet)
  // =========================================================================
  const labelData = [
    { name: 'bug', color: '#D13438' },
    { name: 'amélioration', color: '#107C10' },
    { name: 'technique', color: '#605E5C' },
    { name: 'urgent', color: '#CA5010' },
    { name: 'frontend', color: '#0078D4' },
    { name: 'backend', color: '#8764B8' },
    { name: 'sécurité', color: '#A4262C' },
  ];

  const labelsMap: Record<string, string> = {};
  for (const l of labelData) {
    const created = await prisma.label.create({
      data: { projectId: pVis.id, name: l.name, color: l.color },
    });
    labelsMap[l.name] = created.id;
  }

  // =========================================================================
  // 5. DÉPÔTS GIT ET BRANCHES
  // =========================================================================
  const repo1 = await prisma.repository.create({
    data: {
      projectId: pVis.id,
      name: 'visiora-agile',
      description: 'Dépôt principal du monorepo Visiora Agile (Frontend React 19 & Backend NestJS).',
      provider: GitProvider.GITHUB,
      url: 'https://github.com/visiora-ai/visiora-agile',
      defaultBranch: 'main',
      lastPrNumber: 3,
    },
  });

  const repo2 = await prisma.repository.create({
    data: {
      projectId: pVis.id,
      name: 'visiora-api-core',
      description: 'Microservices & passerelle de calcul d’estimation par IA.',
      provider: GitProvider.GITLAB,
      url: 'https://gitlab.visiora.ai/backend/visiora-api-core',
      defaultBranch: 'main',
      lastPrNumber: 0,
    },
  });

  const branchConfigs = [
    { name: 'main', isProtected: true, isLocalOnly: false },
    { name: 'develop', isProtected: true, isLocalOnly: false },
    { name: 'feature/board-kanban', isProtected: false, isLocalOnly: false },
    { name: 'feature/auth-rbac', isProtected: false, isLocalOnly: false },
    { name: 'fix/sprint-filter-url', isProtected: false, isLocalOnly: true },
    { name: 'feature/sse-notifications', isProtected: false, isLocalOnly: false },
  ];

  const branchesMap: Record<string, string> = {};
  for (const b of branchConfigs) {
    const created = await prisma.branch.create({
      data: {
        repositoryId: repo1.id,
        name: b.name,
        isProtected: b.isProtected,
        isLocalOnly: b.isLocalOnly,
      },
    });
    branchesMap[b.name] = created.id;
  }

  // =========================================================================
  // 6. SPRINTS (Historique & Actif sur VIS)
  // =========================================================================
  const sprint1 = await prisma.sprint.create({
    data: {
      projectId: pVis.id,
      name: 'Sprint 1 · Cadrage & Socle Auth',
      goal: 'Mettre en place le monorepo, l’authentification JWT sécurisée et le modèle de données.',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-14'),
      status: SprintStatus.COMPLETED,
      committedPoints: 26,
      completedPoints: 26,
      closedAt: new Date('2026-08-14T18:00:00Z'),
      retroSummary: 'Excellente vélocité sur le socle technique initial. Découpage Zod partagé très apprécié.',
    },
  });

  // Burndown figé pour Sprint 1
  const s1Dates = [
    { date: new Date('2026-08-01'), rem: 26, comp: 0 },
    { date: new Date('2026-08-04'), rem: 21, comp: 5 },
    { date: new Date('2026-08-08'), rem: 13, comp: 13 },
    { date: new Date('2026-08-11'), rem: 5, comp: 21 },
    { date: new Date('2026-08-14'), rem: 0, comp: 26 },
  ];
  for (const snap of s1Dates) {
    await prisma.sprintSnapshot.create({
      data: {
        sprintId: sprint1.id,
        date: snap.date,
        totalPoints: 26,
        remainingPoints: snap.rem,
        completedPoints: snap.comp,
        totalItems: 6,
        completedItems: Math.round((snap.comp / 26) * 6),
      },
    });
  }

  // Sprint 2 (Actif en cours)
  const sprint2 = await prisma.sprint.create({
    data: {
      projectId: pVis.id,
      name: 'Sprint 2 · Kanban, Sprints & PRs',
      goal: 'Livrer le Task Board Kanban avec drag-and-drop, le backlog hiérarchique et le cycle de vie des PRs.',
      startDate: new Date('2026-08-15'),
      endDate: new Date('2026-08-29'),
      status: SprintStatus.ACTIVE,
    },
  });

  const s2Dates = [
    { date: new Date('2026-08-15'), rem: 34, comp: 0 },
    { date: new Date('2026-08-17'), rem: 29, comp: 5 },
    { date: new Date('2026-08-19'), rem: 21, comp: 13 },
  ];
  for (const snap of s2Dates) {
    await prisma.sprintSnapshot.create({
      data: {
        sprintId: sprint2.id,
        date: snap.date,
        totalPoints: 34,
        remainingPoints: snap.rem,
        completedPoints: snap.comp,
        totalItems: 8,
        completedItems: Math.round((snap.comp / 34) * 8),
      },
    });
  }

  // Sprint 3 (Planifié)
  const sprint3 = await prisma.sprint.create({
    data: {
      projectId: pVis.id,
      name: 'Sprint 3 · Temps Réel & Reporting',
      goal: 'Notifications SSE, export burndown, pièces jointes S3 et audit logs complets.',
      startDate: new Date('2026-08-30'),
      endDate: new Date('2026-09-13'),
      status: SprintStatus.PLANNED,
    },
  });

  // Rétrospective Sprint 1
  await prisma.retrospectiveItem.createMany({
    data: [
      { sprintId: sprint1.id, category: RetroCategory.WENT_WELL, content: 'Monorepo Turborepo + pnpm très rapide', authorId: users['dev1@visiora.ai'].id },
      { sprintId: sprint1.id, category: RetroCategory.WENT_WELL, content: 'Conception RBAC par projet sans faille', authorId: users['po@visiora.ai'].id },
      { sprintId: sprint1.id, category: RetroCategory.TO_IMPROVE, content: 'Les critères d’acceptation doivent être validés avant le sprint planning', authorId: users['dev2@visiora.ai'].id },
      { sprintId: sprint1.id, category: RetroCategory.ACTION_ITEM, content: 'Automatiser la génération du client TypeScript côté frontend', isDone: true, authorId: users['sm@visiora.ai'].id },
    ],
  });

  // =========================================================================
  // 7. JALONS (Milestones pour le calendrier et la roadmap)
  // =========================================================================
  await prisma.milestone.createMany({
    data: [
      { projectId: pVis.id, name: 'Livraison MVP Socle Technique', description: 'Auth, BDD, monorepo et architecture validés', date: new Date('2026-08-14'), isReached: true },
      { projectId: pVis.id, name: 'Bêta Interne Équipe & Kanban', description: 'Ouverture du Task Board à toute l’équipe de dév', date: new Date('2026-08-28'), isReached: false },
      { projectId: pVis.id, name: 'Release Candidate v1.0', description: 'Finalisation des rapports et durcissement DevSecOps', date: new Date('2026-09-20'), isReached: false },
      { projectId: pVis.id, name: 'Mise en Production Officielle', description: 'Déploiement sur cluster Kubernetes sécurisé', date: new Date('2026-10-01'), isReached: false },
    ],
  });

  // =========================================================================
  // 8. TICKETS DU BACKLOG & TASK BOARD (Modèle unifié WorkItem)
  // =========================================================================
  let itemNum = 0;
  const num = () => ++itemNum;

  // --- EPICS ---
  const epicAuth = await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.EPIC,
      title: 'Gestion des Accès, Authentification & Sécurité RBAC',
      description: 'Gestion complète des identités, rôles par projet (PO, SM, DEV, VIEWER) et rotation des tokens JWT.',
      status: WorkItemStatus.DONE,
      priority: Priority.CRITICAL,
      startDate: new Date('2026-08-01'),
      dueDate: new Date('2026-08-14'),
      rank: rankAt(1),
      boardRank: rankAt(1),
      reporterId: users['po@visiora.ai'].id,
      closedAt: new Date('2026-08-14T17:30:00Z'),
    },
  });

  const epicBoard = await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.EPIC,
      title: 'Task Board Kanban Interactif & Ordonnancement LexoRank',
      description: 'Glisser-déposer accessible entre 5 colonnes, filtres d’URL dynamiques et réordonnancement sans collision.',
      status: WorkItemStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      startDate: new Date('2026-08-15'),
      dueDate: new Date('2026-09-05'),
      rank: rankAt(2),
      boardRank: rankAt(2),
      reporterId: users['po@visiora.ai'].id,
    },
  });

  const epicGit = await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.EPIC,
      title: 'Intégration Git & Cycle d’Approbation des Pull Requests',
      description: 'Déclaration des branches, liaison PR ↔ tickets, passage au statut "Prêt pour approbation" et validation PO.',
      status: WorkItemStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      startDate: new Date('2026-08-18'),
      dueDate: new Date('2026-09-12'),
      rank: rankAt(3),
      boardRank: rankAt(3),
      reporterId: users['po@visiora.ai'].id,
    },
  });

  const epicReports = await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.EPIC,
      title: 'Tableaux de Bord, Burndown Chart & Reporting Vélocité',
      description: 'Suivi de vélocité par sprint, calcul du burndown quotidien et indicateurs de productivité d’équipe.',
      status: WorkItemStatus.TODO,
      priority: Priority.MEDIUM,
      startDate: new Date('2026-08-25'),
      dueDate: new Date('2026-09-25'),
      rank: rankAt(4),
      boardRank: rankAt(4),
      reporterId: users['po@visiora.ai'].id,
    },
  });

  // --- STORIES & SOUS-TÂCHES ---

  // Story 1 (DONE - Sprint 1)
  const stLogin = await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.STORY,
      title: 'En tant qu’utilisateur, je m’authentifie avec mon email et mot de passe',
      description: 'Formulaire de connexion avec validation Zod, stockage du token en mémoire et refresh token httpOnly.',
      technicalNotes: 'Bcrypt 10 rounds, cookie SameSite=Lax, protection contre la concurrence de rotation.',
      status: WorkItemStatus.DONE,
      priority: Priority.CRITICAL,
      storyPoints: 5,
      parentId: epicAuth.id,
      sprintId: sprint1.id,
      assigneeId: users['dev1@visiora.ai'].id,
      reporterId: users['po@visiora.ai'].id,
      rank: rankAt(5),
      boardRank: rankAt(5),
      closedAt: new Date('2026-08-10T15:00:00Z'),
      labels: { create: [{ labelId: labelsMap['frontend'] }, { labelId: labelsMap['sécurité'] }] },
    },
  });

  await prisma.acceptanceCriterion.createMany({
    data: [
      { workItemId: stLogin.id, content: 'Le token d’accès est conservé en mémoire vive uniquement', position: 0, isMet: true },
      { workItemId: stLogin.id, content: 'Le cookie de rafraîchissement porte l’attribut httpOnly', position: 1, isMet: true },
      { workItemId: stLogin.id, content: 'Un compte inactif est rejeté avec un message clair', position: 2, isMet: true },
    ],
  });

  // Subtasks Story 1
  await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.SUBTASK,
      title: 'Création du formulaire de connexion React Hook Form + Zod',
      status: WorkItemStatus.DONE,
      storyPoints: 2,
      parentId: stLogin.id,
      sprintId: sprint1.id,
      assigneeId: users['dev1@visiora.ai'].id,
      reporterId: users['dev1@visiora.ai'].id,
      rank: rankAt(6),
      boardRank: rankAt(6),
      closedAt: new Date('2026-08-08T12:00:00Z'),
    },
  });

  await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.SUBTASK,
      title: 'Implémentation AuthService & TokenService NestJS',
      status: WorkItemStatus.DONE,
      storyPoints: 3,
      parentId: stLogin.id,
      sprintId: sprint1.id,
      assigneeId: users['dev2@visiora.ai'].id,
      reporterId: users['dev1@visiora.ai'].id,
      rank: rankAt(7),
      boardRank: rankAt(7),
      closedAt: new Date('2026-08-09T17:00:00Z'),
    },
  });

  // Story 2 (READY_FOR_APPROVAL - Sprint 2)
  const stRBAC = await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.STORY,
      title: 'En tant que Product Owner, j’approuve ou rejette une Pull Request déclarée',
      description: 'L’écran Repos permet au PO de voir les PRs en attente, de visualiser la branche cible et de valider la livraison.',
      technicalNotes: 'Guard ProjectPermissionGuard vérifiant la permission "pr:approve".',
      status: WorkItemStatus.READY_FOR_APPROVAL,
      priority: Priority.HIGH,
      storyPoints: 8,
      parentId: epicGit.id,
      sprintId: sprint2.id,
      assigneeId: users['dev2@visiora.ai'].id,
      reporterId: users['po@visiora.ai'].id,
      rank: rankAt(8),
      boardRank: rankAt(8),
      labels: { create: [{ labelId: labelsMap['backend'] }, { labelId: labelsMap['urgent'] }] },
    },
  });

  await prisma.acceptanceCriterion.createMany({
    data: [
      { workItemId: stRBAC.id, content: 'Seul le Product Owner du projet peut approuver ou demander des changements', position: 0, isMet: true },
      { workItemId: stRBAC.id, content: 'Historique des transitions enregistré dans PullRequestEvent', position: 1, isMet: true },
      { workItemId: stRBAC.id, content: 'Notification envoyée à l’auteur lors du changement de statut', position: 2, isMet: false },
    ],
  });

  // Story 3 (IN_PROGRESS - Sprint 2)
  const stDnD = await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.STORY,
      title: 'En tant qu’utilisateur, je déplace une carte Kanban par glisser-déposer',
      description: 'Intégration @dnd-kit avec mise à jour optimiste du cache React Query et retour en arrière en cas d’erreur réseau.',
      technicalNotes: 'Calcul du boardRank via l’API POST /work-items/:id/move avec beforeId et afterId.',
      status: WorkItemStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      storyPoints: 13,
      parentId: epicBoard.id,
      sprintId: sprint2.id,
      assigneeId: users['dev1@visiora.ai'].id,
      reporterId: users['po@visiora.ai'].id,
      rank: rankAt(9),
      boardRank: rankAt(9),
      labels: { create: [{ labelId: labelsMap['frontend'] }, { labelId: labelsMap['amélioration'] }] },
    },
  });

  // Subtasks Story 3
  await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.SUBTASK,
      title: 'Composant SortableContext et gestion des capteurs clavier / souris',
      status: WorkItemStatus.DONE,
      storyPoints: 5,
      parentId: stDnD.id,
      sprintId: sprint2.id,
      assigneeId: users['dev1@visiora.ai'].id,
      reporterId: users['dev1@visiora.ai'].id,
      rank: rankAt(10),
      boardRank: rankAt(10),
      closedAt: new Date('2026-08-17T11:00:00Z'),
    },
  });

  await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.SUBTASK,
      title: 'Optimistic UI update dans le hook useMoveWorkItem',
      status: WorkItemStatus.IN_PROGRESS,
      storyPoints: 5,
      parentId: stDnD.id,
      sprintId: sprint2.id,
      assigneeId: users['dev1@visiora.ai'].id,
      reporterId: users['dev1@visiora.ai'].id,
      rank: rankAt(11),
      boardRank: rankAt(11),
    },
  });

  // Story 4 (IN_TEST - Sprint 2)
  const stFilters = await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.STORY,
      title: 'En tant que développeur, je filtre les tickets du board par assigné et statut',
      description: 'Barre de filtres persistée dans les query params de l’URL pour permettre le partage direct de liens.',
      status: WorkItemStatus.IN_TEST,
      priority: Priority.MEDIUM,
      storyPoints: 5,
      parentId: epicBoard.id,
      sprintId: sprint2.id,
      assigneeId: users['dev1@visiora.ai'].id,
      reporterId: users['sm@visiora.ai'].id,
      rank: rankAt(12),
      boardRank: rankAt(12),
      labels: { create: [{ labelId: labelsMap['frontend'] }] },
    },
  });

  // Story 5 (TODO - Sprint 2)
  await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.STORY,
      title: 'En tant qu’utilisateur, j’ajoute des pièces jointes sur un ticket',
      description: 'Upload sécurisé avec restriction MIME (PDF, PNG, JPG, ZIP), max 25 Mo et stockage sur bucket objet S3.',
      status: WorkItemStatus.TODO,
      priority: Priority.MEDIUM,
      storyPoints: 8,
      parentId: epicBoard.id,
      sprintId: sprint2.id,
      assigneeId: users['dev2@visiora.ai'].id,
      reporterId: users['po@visiora.ai'].id,
      rank: rankAt(13),
      boardRank: rankAt(13),
      labels: { create: [{ labelId: labelsMap['backend'] }, { labelId: labelsMap['technique'] }] },
    },
  });

  // Bug 1 (TODO - Bloqué - Sprint 2)
  await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.BUG,
      title: 'Erreur 400 lors du déplacement d’une carte si l’assigné a été retiré du projet',
      description: 'Lorsqu’un membre est supprimé d’un projet, ses tickets conservent son ID et provoquent une erreur ASSIGNEE_NOT_MEMBER.',
      status: WorkItemStatus.TODO,
      priority: Priority.CRITICAL,
      storyPoints: 3,
      isBlocked: true,
      blockedReason: 'Nécessite la validation métier sur le comportement souhaité (désassigner automatiquement ou alerter).',
      sprintId: sprint2.id,
      assigneeId: users['dev2@visiora.ai'].id,
      reporterId: users['sm@visiora.ai'].id,
      rank: rankAt(14),
      boardRank: rankAt(14),
      labels: { create: [{ labelId: labelsMap['bug'] }, { labelId: labelsMap['urgent'] }] },
    },
  });

  // Bug 2 (IN_PROGRESS - Sprint 2)
  await prisma.workItem.create({
    data: {
      projectId: pVis.id,
      number: num(),
      type: WorkItemType.BUG,
      title: 'Le compteur de points du backlog n’additionne pas les sous-tâches des bugs',
      description: 'Le calcul rolledUpPoints doit agréger les sous-tâches aussi bien sous les stories que sous les bugs.',
      status: WorkItemStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      storyPoints: 2,
      sprintId: sprint2.id,
      assigneeId: users['dev1@visiora.ai'].id,
      reporterId: users['dev2@visiora.ai'].id,
      rank: rankAt(15),
      boardRank: rankAt(15),
      labels: { create: [{ labelId: labelsMap['bug'] }] },
    },
  });

  // =========================================================================
  // 9. PULL REQUESTS & ÉVÉNEMENTS D'APPROBATION
  // =========================================================================
  const pr1 = await prisma.pullRequest.create({
    data: {
      number: 1,
      workItemId: stRBAC.id,
      repositoryId: repo1.id,
      title: 'feat(rbac): Contrôle d’accès PO pour validation des PRs',
      description: `### Contexte métier
Mise en place des règles de sécurité RBAC pour empêcher les approbations non autorisées.

### Changements apportés
- Ajout du guard \`ProjectPermissionGuard\`
- Règle stricte d'interdiction d'auto-approbation sur branches protégées (\`main\`, \`develop\`)
- Tests unitaires et d'intégration validés`,
      externalNumber: 104,
      externalUrl: 'https://github.com/visiora-ai/visiora-agile/pull/104',
      status: PullRequestStatus.READY_FOR_APPROVAL,
      sourceBranchId: branchesMap['feature/auth-rbac'],
      targetBranchId: branchesMap['develop'],
      declaredById: users['dev2@visiora.ai'].id,
    },
  });

  await prisma.pullRequestEvent.createMany({
    data: [
      { pullRequestId: pr1.id, actorId: users['dev2@visiora.ai'].id, fromStatus: null, toStatus: PullRequestStatus.OPEN, comment: 'PR ouverte avec tests unitaires complets.' },
      { pullRequestId: pr1.id, actorId: users['dev2@visiora.ai'].id, fromStatus: PullRequestStatus.OPEN, toStatus: PullRequestStatus.READY_FOR_APPROVAL, comment: 'Code review demandée à @Amel Ben Salah.' },
    ],
  });

  await prisma.pullRequestComment.create({
    data: {
      pullRequestId: pr1.id,
      authorId: users['dev2@visiora.ai'].id,
      body: 'J’ai vérifié les cas limites de multi-tenancy et la révocation des tokens. Les 12 tests passent sans souci.',
    },
  });

  const pr2 = await prisma.pullRequest.create({
    data: {
      number: 2,
      workItemId: stLogin.id,
      repositoryId: repo1.id,
      title: 'feat(auth): Écran de login et middleware JWT',
      description: `Implémentation complète de l'écran d'authentification avec support du rafraîchissement silencieux de jeton.`,
      externalNumber: 98,
      externalUrl: 'https://github.com/visiora-ai/visiora-agile/pull/98',
      status: PullRequestStatus.APPROVED,
      sourceBranchId: branchesMap['feature/auth-rbac'],
      targetBranchId: branchesMap['main'],
      declaredById: users['dev1@visiora.ai'].id,
      reviewedById: users['po@visiora.ai'].id,
      reviewedAt: new Date('2026-08-10T14:30:00Z'),
      reviewComment: 'Validé avec succès, design conforme à la charte et UX fluide.',
    },
  });

  await prisma.pullRequestEvent.createMany({
    data: [
      { pullRequestId: pr2.id, actorId: users['dev1@visiora.ai'].id, fromStatus: null, toStatus: PullRequestStatus.OPEN, comment: 'Initial PR' },
      { pullRequestId: pr2.id, actorId: users['dev1@visiora.ai'].id, fromStatus: PullRequestStatus.OPEN, toStatus: PullRequestStatus.READY_FOR_APPROVAL, comment: 'Prête pour approbation' },
      { pullRequestId: pr2.id, actorId: users['po@visiora.ai'].id, fromStatus: PullRequestStatus.READY_FOR_APPROVAL, toStatus: PullRequestStatus.APPROVED, comment: 'Approuvé par le Product Owner.' },
    ],
  });

  const pr3 = await prisma.pullRequest.create({
    data: {
      number: 3,
      workItemId: stFilters.id,
      repositoryId: repo1.id,
      title: 'fix(filters): Synchronisation de l’état avec l’URL',
      description: `Correction du bug de persistance des filtres de sprint dans la query string.`,
      externalNumber: 112,
      externalUrl: 'https://github.com/visiora-ai/visiora-agile/pull/112',
      status: PullRequestStatus.CHANGES_REQUESTED,
      sourceBranchId: branchesMap['fix/sprint-filter-url'],
      targetBranchId: branchesMap['develop'],
      declaredById: users['dev1@visiora.ai'].id,
      reviewedById: users['po@visiora.ai'].id,
      reviewedAt: new Date('2026-08-18T16:00:00Z'),
      reviewComment: 'Attention au cas où la valeur est vide : l’URL ne doit pas afficher "?status=" inutilement. Merci de corriger.',
    },
  });

  await prisma.pullRequestEvent.createMany({
    data: [
      { pullRequestId: pr3.id, actorId: users['dev1@visiora.ai'].id, fromStatus: null, toStatus: PullRequestStatus.OPEN, comment: 'Création du correctif.' },
      { pullRequestId: pr3.id, actorId: users['po@visiora.ai'].id, fromStatus: PullRequestStatus.OPEN, toStatus: PullRequestStatus.CHANGES_REQUESTED, comment: 'Modifications demandées sur le nettoyage des URLs vides.' },
    ],
  });

  // =========================================================================
  // 10. COMMENTAIRES & HISTORIQUE D'ACTIVITÉ
  // =========================================================================
  await prisma.comment.create({
    data: {
      workItemId: stRBAC.id,
      authorId: users['dev2@visiora.ai'].id,
      body: 'La branche est déployée sur l’environnement de staging. Prêt pour ta recette @Amel Ben Salah !',
      mentionedUserIds: [users['po@visiora.ai'].id],
    },
  });

  await prisma.comment.create({
    data: {
      workItemId: stRBAC.id,
      authorId: users['po@visiora.ai'].id,
      body: 'Parfait Mehdi, je teste le workflow d’approbation cet après-midi.',
    },
  });

  await prisma.comment.create({
    data: {
      workItemId: stDnD.id,
      authorId: users['sm@visiora.ai'].id,
      body: 'Superbe fluidité sur le drag and drop ! Pense bien à vérifier la navigation au clavier avec la touche Espace.',
    },
  });

  // Audit Logs
  await prisma.activityLog.createMany({
    data: [
      { projectId: pVis.id, entityType: EntityType.WORK_ITEM, entityId: stRBAC.id, actorId: users['dev2@visiora.ai'].id, action: 'status_changed', field: 'status', oldValue: 'IN_PROGRESS', newValue: 'READY_FOR_APPROVAL' },
      { projectId: pVis.id, entityType: EntityType.WORK_ITEM, entityId: stDnD.id, actorId: users['dev1@visiora.ai'].id, action: 'assigned', field: 'assignee', newValue: users['dev1@visiora.ai'].name },
      { projectId: pVis.id, entityType: EntityType.SPRINT, entityId: sprint2.id, actorId: users['sm@visiora.ai'].id, action: 'sprint_started', field: 'status', oldValue: 'PLANNED', newValue: 'ACTIVE' },
    ],
  });

  // =========================================================================
  // 11. NOTIFICATIONS IN-APP
  // =========================================================================
  await prisma.notification.createMany({
    data: [
      {
        userId: users['po@visiora.ai'].id,
        projectId: pVis.id,
        type: NotificationType.PR_READY_FOR_APPROVAL,
        title: 'PR prête pour approbation',
        body: 'Mehdi Gharbi a marqué la PR #104 prête pour validation PO.',
        entityType: EntityType.PULL_REQUEST,
        entityId: pr1.id,
        isRead: false,
      },
      {
        userId: users['po@visiora.ai'].id,
        projectId: pVis.id,
        type: NotificationType.ITEM_MENTIONED,
        title: 'Mention dans VIS-4',
        body: 'Mehdi Gharbi vous a mentionné dans un commentaire sur VIS-4.',
        entityType: EntityType.WORK_ITEM,
        entityId: stRBAC.id,
        isRead: false,
      },
      {
        userId: users['dev1@visiora.ai'].id,
        projectId: pVis.id,
        type: NotificationType.ITEM_ASSIGNED,
        title: 'Ticket assigné : VIS-5',
        body: 'Vous avez été assigné au ticket "Glisser-déposer carte Kanban".',
        entityType: EntityType.WORK_ITEM,
        entityId: stDnD.id,
        isRead: true,
        readAt: new Date('2026-08-16T09:00:00Z'),
      },
      {
        userId: users['admin@visiora.ai'].id,
        projectId: pVis.id,
        type: NotificationType.PROJECT_MEMBER_ADDED,
        title: 'Bienvenue sur VisioraAI Agile',
        body: 'Votre compte administrateur a été configuré avec succès.',
        entityType: EntityType.PROJECT,
        entityId: pVis.id,
        isRead: true,
      },
    ],
  });

  // Mettre à jour le compteur global du projet
  await prisma.project.update({
    where: { id: pVis.id },
    data: { lastItemNumber: itemNum },
  });

  console.log(`\n🎉 Seed terminé avec succès !`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  Projets créés       : 4 (VIS, ECOM, AI, LEG)`);
  console.log(`  Sprints créés       : 3 (1 Clôturé avec Burndown, 1 Actif, 1 Planifié)`);
  console.log(`  Tickets générés     : ${itemNum} (Epics, Stories, Bugs, Sous-tâches)`);
  console.log(`  Colonnes Board      : Toutes garnies (TODO, IN_PROGRESS, IN_TEST, READY_FOR_APPROVAL, DONE)`);
  console.log(`  Pull Requests       : 3 (OPEN, READY_FOR_APPROVAL, APPROVED, CHANGES_REQUESTED)`);
  console.log(`  Commentaires & Notifs: Générés pour tous les comptes`);
  console.log(`---------------------------------------------------------------`);
  console.log(`  Comptes de test (Mot de passe : ${DEMO_PASSWORD}) :`);
  console.log(`    - Admin Global       : admin@visiora.ai`);
  console.log(`    - Product Owner      : po@visiora.ai`);
  console.log(`    - Scrum Master       : sm@visiora.ai`);
  console.log(`    - Dev Fullstack      : dev1@visiora.ai`);
  console.log(`    - Dev Backend        : dev2@visiora.ai`);
  console.log(`    - Observateur Client : viewer@visiora.ai`);
  console.log(`---------------------------------------------------------------\n`);
}

main()
  .catch((e) => {
    console.error('❌ Échec du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
