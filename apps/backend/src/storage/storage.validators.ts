import { BadRequestException } from '@nestjs/common';
import {
  DocumentFieldFilter,
  StorageCollectionSchema,
  StorageFieldType,
  StorageSchemaField,
} from './storage.types';

const SUPPORTED_FIELD_TYPES: StorageFieldType[] = [
  'string',
  'number',
  'boolean',
  'array',
  'object',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateSchemaField(field: unknown, index: number): StorageSchemaField {
  if (!isPlainObject(field)) {
    throw new BadRequestException(`schema.fields[${index}] must be an object`);
  }

  const key = field.key;
  const type = field.type;
  const required = field.required;

  if (typeof key !== 'string' || key.trim() === '') {
    throw new BadRequestException(`schema.fields[${index}].key must be a non-empty string`);
  }

  if (!SUPPORTED_FIELD_TYPES.includes(type as StorageFieldType)) {
    throw new BadRequestException(
      `schema.fields[${index}].type must be one of: ${SUPPORTED_FIELD_TYPES.join(', ')}`,
    );
  }

  if (required !== undefined && typeof required !== 'boolean') {
    throw new BadRequestException(`schema.fields[${index}].required must be a boolean`);
  }

  return {
    key: key.trim(),
    type: type as StorageFieldType,
    required: required ?? false,
  };
}

export function validateCollectionSchema(
  schema?: unknown,
): StorageCollectionSchema | null {
  if (schema === undefined || schema === null) {
    return null;
  }

  if (!isPlainObject(schema)) {
    throw new BadRequestException('schema must be an object');
  }

  const fields = schema.fields;
  if (!Array.isArray(fields)) {
    throw new BadRequestException('schema.fields must be an array');
  }

  const normalizedFields = fields.map((field, index) =>
    validateSchemaField(field, index),
  );

  const seenKeys = new Set<string>();
  for (const field of normalizedFields) {
    if (seenKeys.has(field.key)) {
      throw new BadRequestException(`schema.fields contains duplicate key "${field.key}"`);
    }
    seenKeys.add(field.key);
  }

  return { fields: normalizedFields };
}

function matchesType(value: unknown, type: StorageFieldType) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
    default:
      return false;
  }
}

export function validateDocumentPayload(
  schema: StorageCollectionSchema | null,
  data: unknown,
) {
  if (!isPlainObject(data)) {
    throw new BadRequestException('data must be a JSON object');
  }

  if (!schema) {
    return data;
  }

  for (const field of schema.fields) {
    const value = data[field.key];

    if (field.required && (value === undefined || value === null)) {
      throw new BadRequestException(`data.${field.key} is required`);
    }

    if (value !== undefined && value !== null && !matchesType(value, field.type)) {
      throw new BadRequestException(`data.${field.key} must be of type ${field.type}`);
    }
  }

  return data;
}

function coerceScalar(value: string): string | number | boolean | null {
  if (value === 'null') {
    return null;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }

  return value;
}

export function parseFieldFilters(
  query: Record<string, unknown>,
): DocumentFieldFilter[] {
  const filters: DocumentFieldFilter[] = [];

  for (const [key, rawValue] of Object.entries(query)) {
    if (!key.startsWith('data.')) {
      continue;
    }

    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value !== 'string') {
      continue;
    }

    const [, rawField] = key.split('data.');
    const [field, rawOperator] = rawField.split('__');
    if (!field) {
      continue;
    }

    const operator = (rawOperator ?? 'eq') as DocumentFieldFilter['operator'];
    if (!['eq', 'gt', 'gte', 'lt', 'lte'].includes(operator)) {
      throw new BadRequestException(
        `Unsupported data filter operator "${rawOperator}" for field "${field}"`,
      );
    }

    filters.push({
      field,
      operator,
      value: coerceScalar(value),
    });
  }

  return filters;
}
