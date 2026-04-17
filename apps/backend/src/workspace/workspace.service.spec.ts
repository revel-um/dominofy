import { ForbiddenException } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceRole } from './workspace-membership.entity';

describe('WorkspaceService', () => {
  let workspaceRepository: {
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let membershipRepository: {
    findOne: jest.Mock;
  };
  let service: WorkspaceService;

  beforeEach(() => {
    workspaceRepository = {
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    membershipRepository = {
      findOne: jest.fn(),
    };

    service = new WorkspaceService(
      workspaceRepository as any,
      membershipRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('rejects workspace deletion for members', async () => {
    membershipRepository.findOne.mockResolvedValue(null);

    await expect(service.deleteWorkspace('user-1', 'workspace-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(workspaceRepository.remove).not.toHaveBeenCalled();
  });

  it('allows admins to delete a workspace', async () => {
    membershipRepository.findOne.mockResolvedValue({
      workspace: { id: 'workspace-1' },
      user: { id: 'user-1' },
      role: WorkspaceRole.ADMIN,
    });
    workspaceRepository.findOne.mockResolvedValue({ id: 'workspace-1' });

    await expect(service.deleteWorkspace('user-1', 'workspace-1')).resolves.toEqual({
      deleted: true,
      id: 'workspace-1',
    });
    expect(workspaceRepository.remove).toHaveBeenCalledWith({ id: 'workspace-1' });
  });
});
