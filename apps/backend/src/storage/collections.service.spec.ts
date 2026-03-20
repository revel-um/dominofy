import { NotFoundException } from '@nestjs/common';
import { CollectionsService } from './collections.service';

describe('CollectionsService', () => {
  const createRepository = () => ({
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'collection-1', ...value })),
    findAndCount: jest.fn(async () => [[], 0]),
    findOne: jest.fn(),
  });

  it('creates a collection in the resolved workspace', async () => {
    const repository = createRepository();
    const workspaceService = {
      resolveWorkspaceIdForUser: jest.fn(async () => 'workspace-1'),
    };

    const service = new CollectionsService(repository as any, workspaceService as any);

    const created = await service.create(
      'user-1',
      {
        name: 'Leads',
        schema: { fields: [{ key: 'email', type: 'string', required: true }] },
      },
      undefined,
    );

    expect(workspaceService.resolveWorkspaceIdForUser).toHaveBeenCalledWith(
      'user-1',
      undefined,
      expect.any(Array),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        name: 'Leads',
        slug: 'leads',
      }),
    );
    expect(created.workspaceId).toBe('workspace-1');
  });

  it('rejects collection lookup outside the resolved workspace', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue(null);

    const workspaceService = {
      resolveWorkspaceIdForUser: jest.fn(async () => 'workspace-1'),
    };

    const service = new CollectionsService(repository as any, workspaceService as any);

    await expect(service.getById('collection-2', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'collection-2', workspaceId: 'workspace-1' },
    });
  });
});
