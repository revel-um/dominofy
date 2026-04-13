import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeployedExecutionMetrics1766000000000
  implements MigrationInterface
{
  name = 'CreateDeployedExecutionMetrics1766000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'deployed_execution_metrics_status_enum'
        ) THEN
          CREATE TYPE "deployed_execution_metrics_status_enum" AS ENUM ('running', 'success', 'failure');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deployed_execution_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "workflowId" uuid NOT NULL,
        "deployedWorkflowId" uuid NOT NULL,
        "runId" character varying NOT NULL,
        "executedAt" TIMESTAMP NOT NULL,
        "status" "deployed_execution_metrics_status_enum" NOT NULL,
        "failureReason" text,
        CONSTRAINT "PK_deployed_execution_metrics" PRIMARY KEY ("id"),
        CONSTRAINT "FK_deployed_execution_metrics_workflow"
          FOREIGN KEY ("workflowId")
          REFERENCES "workflows"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_deployed_execution_metrics_deployment"
          FOREIGN KEY ("deployedWorkflowId")
          REFERENCES "deployed_workflows"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_deployed_execution_metric_run_id"
        ON "deployed_execution_metrics" ("runId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_deployed_execution_metric_workflow"
        ON "deployed_execution_metrics" ("workflowId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_deployed_execution_metric_deployment"
        ON "deployed_execution_metrics" ("deployedWorkflowId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_deployed_execution_metric_deployment"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_deployed_execution_metric_workflow"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_deployed_execution_metric_run_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "deployed_execution_metrics"`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'deployed_execution_metrics_status_enum'
        ) THEN
          DROP TYPE "deployed_execution_metrics_status_enum";
        END IF;
      END$$;
    `);
  }
}
