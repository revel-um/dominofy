import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkspaces1760000000000 implements MigrationInterface {
  name = 'CreateWorkspaces1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'workspace_memberships_role_enum'
        ) THEN
          CREATE TYPE "workspace_memberships_role_enum" AS ENUM ('owner', 'admin', 'member', 'viewer');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspaces" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "slug" character varying,
        "createdById" uuid,
        CONSTRAINT "PK_workspaces_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workspaces_createdById" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "role" "workspace_memberships_role_enum" NOT NULL DEFAULT 'owner',
        "permissions" jsonb,
        "workspaceId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        CONSTRAINT "PK_workspace_memberships_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_workspace_memberships_workspace_user" UNIQUE ("workspaceId", "userId"),
        CONSTRAINT "FK_workspace_memberships_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_workspace_memberships_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "workspaceId" uuid;
    `);

    await queryRunner.query(`
      INSERT INTO "workspaces" ("name", "createdById")
      SELECT CONCAT(COALESCE(NULLIF("name", ''), split_part("email", '@', 1)), '''s Workspace'), "id"
      FROM "users" u
      WHERE NOT EXISTS (
        SELECT 1
        FROM "workspaces" w
        WHERE w."createdById" = u."id"
      );
    `);

    await queryRunner.query(`
      INSERT INTO "workspace_memberships" ("workspaceId", "userId", "role")
      SELECT w."id", u."id", 'owner'
      FROM "users" u
      INNER JOIN "workspaces" w ON w."createdById" = u."id"
      WHERE NOT EXISTS (
        SELECT 1
        FROM "workspace_memberships" wm
        WHERE wm."workspaceId" = w."id"
          AND wm."userId" = u."id"
      );
    `);

    await queryRunner.query(`
      UPDATE "projects" p
      SET "workspaceId" = w."id"
      FROM "workspaces" w
      WHERE p."workspaceId" IS NULL
        AND w."createdById" = p."userId";
    `);

    await queryRunner.query(`
      ALTER TABLE "projects"
      ALTER COLUMN "workspaceId" SET NOT NULL;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_projects_workspaceId'
            AND table_name = 'projects'
        ) THEN
          ALTER TABLE "projects"
          ADD CONSTRAINT "FK_projects_workspaceId"
          FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_projects_workspaceId" ON "projects" ("workspaceId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_projects_workspaceId";`);
    await queryRunner.query(`
      ALTER TABLE "projects"
      DROP CONSTRAINT IF EXISTS "FK_projects_workspaceId";
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
      DROP COLUMN IF EXISTS "workspaceId";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_memberships";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspaces";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "workspace_memberships_role_enum";`);
  }
}
