export type StorageFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface StorageSchemaField {
  key: string;
  type: StorageFieldType;
  required?: boolean;
}

export interface StorageCollectionSchema {
  fields: StorageSchemaField[];
}

export interface DocumentFieldFilter {
  field: string;
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string | number | boolean | null;
}
