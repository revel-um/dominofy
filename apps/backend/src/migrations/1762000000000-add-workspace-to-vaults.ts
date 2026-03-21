import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceToVaults1762000000000 implements MigrationInterface {
  name = 'AddWorkspaceToVaults1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "vaults"
      ADD COLUMN IF NOT EXISTS "workspaceId" uuid;
    `);

    await queryRunner.query(`
      UPDATE "vaults" v
      SET "workspaceId" = assignment."workspaceId"
      FROM (
        SELECT DISTINCT ON (vu."vault_id")
          vu."vault_id" AS "vaultId",
          wm."workspaceId" AS "workspaceId"
        FROM "vault_users" vu
        INNER JOIN "workspace_memberships" wm
          ON wm."userId" = vu."user_id"
        ORDER BY vu."vault_id", wm."createdAt" ASC
      ) assignment
      WHERE v."id" = assignment."vaultId"
        AND v."workspaceId" IS NULL;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "vaults"
          WHERE "workspaceId" IS NULL
        ) THEN
          RAISE EXCEPTION 'Cannot enforce NOT NULL on vaults.workspaceId because some vault rows could not be backfilled';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "vaults"
      ALTER COLUMN "workspaceId" SET NOT NULL;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_vaults_workspaceId'
            AND table_name = 'vaults'
        ) THEN
          ALTER TABLE "vaults"
          ADD CONSTRAINT "FK_vaults_workspaceId"
          FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaults_workspaceId" ON "vaults" ("workspaceId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vaults_workspaceId";`);
    await queryRunner.query(`
      ALTER TABLE "vaults"
      DROP CONSTRAINT IF EXISTS "FK_vaults_workspaceId";
    `);
    await queryRunner.query(`
      ALTER TABLE "vaults"
      DROP COLUMN IF EXISTS "workspaceId";
    `);
  }
}
