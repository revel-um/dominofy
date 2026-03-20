import { Collection } from './collection.entity';
import { Document } from './document.entity';

export function mapCollectionResponse(collection: Collection) {
  return {
    id: collection.id,
    workspaceId: collection.workspaceId,
    name: collection.name,
    slug: collection.slug,
    schema: collection.schemaJsonb ?? null,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

export function mapDocumentResponse(document: Document) {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    collectionId: document.collectionId,
    documentKey: document.documentKey ?? null,
    status: document.status ?? null,
    createdBy: document.createdById ?? null,
    updatedBy: document.updatedById ?? null,
    data: document.dataJsonb,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
