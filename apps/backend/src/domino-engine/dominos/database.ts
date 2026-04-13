import { PipelineStep } from '../../../../../shared/types/pipelineStepType';
import {
  DominoExecutable,
  ExecuteContext,
  DominoResult,
} from '../domino-engine.type';
import { StorageRuntimeService } from '../../storage/storage-runtime.service';

export class DatabaseDomino implements DominoExecutable {
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
        data: result.document.dataJsonb,
      },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}

export class DatabaseRetrievalDomino implements DominoExecutable {
  id: string;
  type = 'storageRetrieve' as const;

  private literalCollection: string;
  private literalOperation: string;
  private literalDocumentKey: string;
  private literalLimit: string;
  private literalOffset: string;

  constructor(node: PipelineStep) {
    this.id = node.id;
    this.literalCollection = node.data?.Collection?.value ?? '';
    this.literalOperation = node.data?.Operation?.value ?? 'document';
    this.literalDocumentKey = node.data?.['Document Key']?.value ?? '';
    this.literalLimit = node.data?.Limit?.value ?? '25';
    this.literalOffset = node.data?.Offset?.value ?? '0';
  }

  async execute(ctx: ExecuteContext): Promise<DominoResult> {
    const startedAt = Date.now();
    const input = (ctx.input ?? {}) as Record<string, any>;
    const workflowId = ctx.workflowId;

    if (!workflowId) {
      throw new Error('Storage retrieval: workflow context is required');
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

    const limit =
      input.Limit ??
      input.limit ??
      this.literalLimit;

    const offset =
      input.Offset ??
      input.offset ??
      this.literalOffset;

    const result = await StorageRuntimeService.instance.readForWorkflow({
      workflowId,
      collectionRef: String(collectionRef ?? ''),
      operation: operation == null ? undefined : String(operation),
      documentKey: documentKey == null ? null : String(documentKey),
      limit,
      offset,
    });

    const normalizedOffset = Math.max(0, Math.floor(Number(offset ?? 0) || 0));
    const normalizedLimit = Math.max(1, Math.floor(Number(limit ?? 25) || 25));
    const page = result.action === 'list'
      ? Math.floor(normalizedOffset / normalizedLimit) + 1
      : 1;
    const data =
      result.action === 'list'
        ? result.documents.map((document) => document.dataJsonb)
        : (result.documents[0]?.dataJsonb ?? null);

    return {
      id: this.id,
      output: {
        count: result.count,
        page,
        offset: normalizedOffset,
        data,
      },
      startedAt,
      finishedAt: Date.now(),
    };
  }
}
