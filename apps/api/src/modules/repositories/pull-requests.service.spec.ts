import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PullRequestStatus } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../collaboration/notifications.service';
import { PullRequestsService } from './pull-requests.service';
import { RepositoriesService } from './repositories.service';

describe('PullRequestsService', () => {
  let service: PullRequestsService;
  let prisma: {
    pullRequest: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    pullRequestEvent: {
      create: jest.Mock;
    };
    pullRequestComment: {
      create: jest.Mock;
    };
    workItem: {
      findFirst: jest.Mock;
    };
    repository: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    branch: {
      findFirst: jest.Mock;
    };
    projectMember: {
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let repositories: {
    assertRepository: jest.Mock;
    assertBranch: jest.Mock;
  };
  let notifications: {
    notifyPullRequestEvent: jest.Mock;
  };

  const mockUser = {
    id: 'user-dev-1',
    name: 'Ahmed Jmal',
    email: 'ahmed@visiora.ai',
    avatarUrl: null,
  };

  const mockReviewer = {
    id: 'user-po-1',
    name: 'Amel Ben Salah',
    email: 'po@visiora.ai',
    avatarUrl: null,
  };

  beforeEach(async () => {
    prisma = {
      pullRequest: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pullRequestEvent: {
        create: jest.fn(),
      },
      pullRequestComment: {
        create: jest.fn(),
      },
      workItem: {
        findFirst: jest.fn(),
      },
      repository: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      branch: {
        findFirst: jest.fn(),
      },
      projectMember: {
        findMany: jest.fn().mockResolvedValue([{ userId: mockReviewer.id }]),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(prisma)),
    };

    repositories = {
      assertRepository: jest.fn().mockResolvedValue(undefined),
      assertBranch: jest.fn().mockResolvedValue(undefined),
    };

    notifications = {
      notifyPullRequestEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PullRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RepositoriesService, useValue: repositories },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<PullRequestsService>(PullRequestsService);
  });

  describe('create', () => {
    it('should reject PR creation when source and target branches are identical', async () => {
      prisma.workItem.findFirst.mockResolvedValue({ id: 'item-1', number: 1, title: 'Auth' });

      await expect(
        service.create(
          'proj-1',
          {
            workItemId: 'item-1',
            repositoryId: 'repo-1',
            title: 'Same branch PR',
            sourceBranchId: 'branch-same',
            targetBranchId: 'branch-same',
          },
          mockUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject PR creation when an active duplicate PR already exists', async () => {
      prisma.workItem.findFirst.mockResolvedValue({ id: 'item-1', number: 1, title: 'Auth' });
      prisma.pullRequest.findFirst.mockResolvedValue({ id: 'pr-active', number: 12 });

      await expect(
        service.create(
          'proj-1',
          {
            workItemId: 'item-1',
            repositoryId: 'repo-1',
            title: 'Duplicate PR',
            sourceBranchId: 'branch-src',
            targetBranchId: 'branch-tgt',
          },
          mockUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus & Review Workflow', () => {
    it('should prevent author from self-approving on protected target branch', async () => {
      prisma.pullRequest.findFirst.mockResolvedValue({
        id: 'pr-1',
        number: 142,
        title: 'Login validation',
        status: PullRequestStatus.READY_FOR_APPROVAL,
        declaredById: mockUser.id,
        repositoryId: 'repo-1',
        targetBranch: { isProtected: true, name: 'develop' },
      });

      await expect(
        service.updateStatus(
          'proj-1',
          'pr-1',
          { status: PullRequestStatus.APPROVED },
          mockUser.id, // Même utilisateur que declaredById
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should require a non-empty reason when rejecting a PR', async () => {
      prisma.pullRequest.findFirst.mockResolvedValue({
        id: 'pr-1',
        number: 142,
        title: 'Login validation',
        status: PullRequestStatus.READY_FOR_APPROVAL,
        declaredById: mockUser.id,
        repositoryId: 'repo-1',
        targetBranch: { isProtected: true, name: 'develop' },
      });

      await expect(
        service.updateStatus(
          'proj-1',
          'pr-1',
          { status: PullRequestStatus.REJECTED, rejectionReason: '' },
          mockReviewer.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require a non-empty reason when requesting changes', async () => {
      prisma.pullRequest.findFirst.mockResolvedValue({
        id: 'pr-1',
        number: 142,
        title: 'Login validation',
        status: PullRequestStatus.READY_FOR_APPROVAL,
        declaredById: mockUser.id,
        repositoryId: 'repo-1',
        targetBranch: { isProtected: true, name: 'develop' },
      });

      await expect(
        service.updateStatus(
          'proj-1',
          'pr-1',
          { status: PullRequestStatus.CHANGES_REQUESTED, comment: '' },
          mockReviewer.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when attempting an invalid status transition (e.g. MERGED -> OPEN)', async () => {
      prisma.pullRequest.findFirst.mockResolvedValue({
        id: 'pr-1',
        number: 142,
        title: 'Login validation',
        status: PullRequestStatus.MERGED,
        declaredById: mockUser.id,
        repositoryId: 'repo-1',
        targetBranch: { isProtected: true, name: 'develop' },
      });

      await expect(
        service.updateStatus(
          'proj-1',
          'pr-1',
          { status: PullRequestStatus.OPEN },
          mockReviewer.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
