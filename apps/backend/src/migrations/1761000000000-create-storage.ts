import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStorage1761000000000 implements MigrationInterface {
  name = 'CreateStorage1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "collections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "schema_jsonb" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_collections_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_collections_workspace_id"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_collections_workspace_id_slug"
          UNIQUE ("workspace_id", "slug")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL,
        "collection_id" uuid NOT NULL,
        "document_key" text,
        "status" text,
        "created_by" uuid,
        "updated_by" uuid,
        "data_jsonb" jsonb NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_documents_workspace_id"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_documents_collection_id"
          FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_documents_created_by"
          FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_documents_updated_by"
          FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_documents_workspace_collection_document_key"
          UNIQUE ("workspace_id", "collection_id", "document_key")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collections_workspace_id"
      ON "collections" ("workspace_id");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_collections_workspace_slug"
      ON "collections" ("workspace_id", "slug");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_workspace_id"
      ON "documents" ("workspace_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_workspace_collection_id"
      ON "documents" ("workspace_id", "collection_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_workspace_created_at_desc"
      ON "documents" ("workspace_id", "created_at" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_data_jsonb_gin"
      ON "documents" USING GIN ("data_jsonb");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_data_jsonb_gin";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_workspace_created_at_desc";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_workspace_collection_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_workspace_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_collections_workspace_slug";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_collections_workspace_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "collections";`);
  }
}
