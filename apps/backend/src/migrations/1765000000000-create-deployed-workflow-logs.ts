import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeployedWorkflowLogs1765000000000 implements MigrationInterface {
  name = 'CreateDeployedWorkflowLogs1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'deployed_workflow_logs_status_enum'
        ) THEN
          CREATE TYPE "deployed_workflow_logs_status_enum" AS ENUM ('success', 'failure');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deployed_workflow_logs" (
        "id"                 uuid                                 NOT NULL DEFAULT uuid_generate_v4(),
        "isActive"           boolean                              NOT NULL DEFAULT true,
        "createdAt"          TIMESTAMP                            NOT NULL DEFAULT now(),
        "updatedAt"          TIMESTAMP                            NOT NULL DEFAULT now(),
        "deployedWorkflowId" uuid                                 NOT NULL,
        "runId"              character varying                    NOT NULL,
        "dominoId"           character varying                    NOT NULL,
        "status"             "deployed_workflow_logs_status_enum" NOT NULL,
        "output"             jsonb,
        "error"              jsonb,
        CONSTRAINT "PK_deployed_workflow_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_deployed_workflow_logs_deployed_workflow"
          FOREIGN KEY ("deployedWorkflowId")
          REFERENCES "deployed_workflows"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_deployed_workflowlog_run_domino_unique"
        ON "deployed_workflow_logs" ("runId", "dominoId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_deployed_workflowlog_run_domino_unique"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "deployed_workflow_logs"`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'deployed_workflow_logs_status_enum'
        ) THEN
          DROP TYPE "deployed_workflow_logs_status_enum";
        END IF;
      END$$;
    `);
  }
}
