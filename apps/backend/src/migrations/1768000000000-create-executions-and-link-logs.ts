import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExecutionsAndLinkLogs1768000000000 implements MigrationInterface {
  name = 'CreateExecutionsAndLinkLogs1768000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "deployed_execution_metrics" CASCADE`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'execution_status_enum'
        ) THEN
          CREATE TYPE "execution_status_enum" AS ENUM ('running', 'success', 'failure');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "executions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "isActive" boolean NOT NULL DEFAULT true,
        "deployedWorkflowId" uuid NOT NULL,
        "runId" character varying NOT NULL,
        "executedAt" TIMESTAMP NOT NULL,
        "isDeployed" boolean NOT NULL DEFAULT true,
        "deployedWorkflowVersion" integer NULL,
        "status" "execution_status_enum" NOT NULL,
        "failureReason" text NULL,
        CONSTRAINT "PK_executions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_execution_runId" UNIQUE ("runId"),
        CONSTRAINT "FK_execution_deployed_workflow"
          FOREIGN KEY ("deployedWorkflowId")
          REFERENCES "deployed_workflows"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_execution_deployed_workflow"
        ON "executions" ("deployedWorkflowId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_execution_is_deployed"
        ON "executions" ("isDeployed")
    `);

    await queryRunner.query(`
      ALTER TABLE "workflow_logs"
      ADD COLUMN IF NOT EXISTS "executionId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "deployed_workflow_logs"
      ADD COLUMN IF NOT EXISTS "executionId" uuid NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_workflow_logs_execution'
        ) THEN
          ALTER TABLE "workflow_logs"
          ADD CONSTRAINT "FK_workflow_logs_execution"
          FOREIGN KEY ("executionId")
          REFERENCES "executions"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_deployed_workflow_logs_execution'
        ) THEN
          ALTER TABLE "deployed_workflow_logs"
          ADD CONSTRAINT "FK_deployed_workflow_logs_execution"
          FOREIGN KEY ("executionId")
          REFERENCES "executions"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workflow_logs_execution"
        ON "workflow_logs" ("executionId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_deployed_workflow_logs_execution"
        ON "deployed_workflow_logs" ("executionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_deployed_workflow_logs_execution"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_workflow_logs_execution"`);
    await queryRunner.query(`
      ALTER TABLE "deployed_workflow_logs"
      DROP CONSTRAINT IF EXISTS "FK_deployed_workflow_logs_execution"
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_logs"
      DROP CONSTRAINT IF EXISTS "FK_workflow_logs_execution"
    `);
    await queryRunner.query(`
      ALTER TABLE "deployed_workflow_logs"
      DROP COLUMN IF EXISTS "executionId"
    `);
    await queryRunner.query(`
      ALTER TABLE "workflow_logs"
      DROP COLUMN IF EXISTS "executionId"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_execution_is_deployed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_execution_deployed_workflow"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "executions"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'execution_status_enum'
        ) THEN
          DROP TYPE "execution_status_enum";
        END IF;
      END
      $$;
    `);
  }
}
