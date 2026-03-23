import { DatabaseDomino } from './database';

describe('DatabaseDomino', () => {
  it('passes workflow-scoped storage input to the runtime service singleton', async () => {
    const storeForWorkflow = jest.fn(async () => ({
      action: 'created',
      collectionId: 'collection-1',
      document: {
        id: 'document-1',
        workspaceId: 'workspace-1',
        collectionId: 'collection-1',
        documentKey: 'customer-1',
        status: 'active',
        dataJsonb: { email: 'a@test.com' },
        createdAt: new Date('2026-03-21T00:00:00.000Z'),
        updatedAt: new Date('2026-03-21T00:00:00.000Z'),
      },
    }));

    (require('../../storage/storage-runtime.service').StorageRuntimeService as any)._instance = {
      storeForWorkflow,
    };

    const domino = new DatabaseDomino({
      id: 'storage-1',
      type: 'storage',
      data: {
        Collection: { value: 'customers' },
        Operation: { value: 'upsert' },
        'Document Key': { value: 'customer-1' },
        Data: { value: '{"email":"a@test.com"}' },
      },
      next: {},
    });

    const result = await domino.execute({
      runId: 'run-1',
      workflowId: 'workflow-1',
      input: {},
      globals: {},
      local: {},
      setLocal: jest.fn(),
    });

    expect(storeForWorkflow).toHaveBeenCalledWith({
      workflowId: 'workflow-1',
      collectionRef: 'customers',
      operation: 'upsert',
      documentKey: 'customer-1',
      data: '{"email":"a@test.com"}',
    });
    expect(result.output.ok).toBe(true);
    expect(result.output.document.data).toEqual({ email: 'a@test.com' });
  });
});
