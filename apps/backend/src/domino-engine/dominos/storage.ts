import { PipelineStep } from '../../../../../shared/types/pipelineStepType';
import {
  DominoExecutable,
  ExecuteContext,
  DominoResult,
} from '../domino-engine.type';
import { StorageRuntimeService } from '../../storage/storage-runtime.service';

export class StorageDomino implements DominoExecutable {
  id: string;
  type = 'storage' as const;

  private literalCollection: string;
  private literalOperation: string;
  private literalDocumentKey: string;
  private literalData: unknown;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalCollection = node.data?.Collection?.value ?? '';
    this.literalOperation = node.data?.Operation?.value ?? 'create';
    this.literalDocumentKey = node.data?.['Document Key']?.value ?? '';
    this.literalData = node.data?.Data?.value ?? null;
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const input = (ctx.input ?? {}) as Record<string, any>;
    const workflowId = ctx.workflowId;

    if (!workflowId) {
      throw new Error('Storage: workflow context is required');
    }

    const collectionRef =
      input.Collection ??
      input.collection ??
      input.collectionRef ??
      input.collectionId ??
      input.collectionSlug ??
      this.literalCollection;

    const operation =
      input.Operation ??
      input.operation ??
      input.mode ??
      this.literalOperation;

    const documentKey =
      input['Document Key'] ??
      input.documentKey ??
      input.key ??
      this.literalDocumentKey;

    const data = input.Data ?? input.data ?? this.literalData;

    const result = await StorageRuntimeService.instance.storeForWorkflow({
      workflowId,
      collectionRef: String(collectionRef ?? ''),
      operation: operation == null ? undefined : String(operation),
      documentKey: documentKey == null ? null : String(documentKey),
      data,
    });
    return {
      id: this.id,
      output: {
        ok: true,
        action: result.action,
        collectionId: result.collectionId,
        document: {
          id: result.document.id,
          workspaceId: result.document.workspaceId,
          collectionId: result.document.collectionId,
          documentKey: result.document.documentKey ?? null,
          status: result.document.status ?? null,
          data: result.document.dataJsonb,
          createdAt: result.document.createdAt,
          updatedAt: result.document.updatedAt,
        },
      },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
