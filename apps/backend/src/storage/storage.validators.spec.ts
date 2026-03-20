import { BadRequestException } from '@nestjs/common';
import {
  parseFieldFilters,
  validateCollectionSchema,
  validateDocumentPayload,
} from './storage.validators';

describe('storage validators', () => {
  it('normalizes a valid collection schema', () => {
    expect(
      validateCollectionSchema({
        fields: [
          { key: 'name', type: 'string', required: true },
          { key: 'score', type: 'number' },
        ],
      }),
    ).toEqual({
      fields: [
        { key: 'name', type: 'string', required: true },
        { key: 'score', type: 'number', required: false },
      ],
    });
  });

  it('rejects duplicate schema keys', () => {
    expect(() =>
      validateCollectionSchema({
        fields: [
          { key: 'name', type: 'string' },
          { key: 'name', type: 'string' },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('validates a document against required schema fields and types', () => {
    const schema = validateCollectionSchema({
      fields: [
        { key: 'name', type: 'string', required: true },
        { key: 'score', type: 'number' },
      ],
    });

    expect(() =>
      validateDocumentPayload(schema, { score: 10 }),
    ).toThrow('data.name is required');

    expect(() =>
      validateDocumentPayload(schema, { name: 'Utsav', score: 'wrong' }),
    ).toThrow('data.score must be of type number');

    expect(
      validateDocumentPayload(schema, { name: 'Utsav', score: 99 }),
    ).toEqual({ name: 'Utsav', score: 99 });
  });

  it('parses exact and numeric top-level data filters', () => {
    expect(
      parseFieldFilters({
        'data.email': 'a@test.com',
        'data.score__gt': '80',
        unrelated: 'ignored',
      }),
    ).toEqual([
      { field: 'email', operator: 'eq', value: 'a@test.com' },
      { field: 'score', operator: 'gt', value: 80 },
    ]);
  });
});
