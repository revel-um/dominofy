import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersionToDeployedExecutionMetrics1767000000000
  implements MigrationInterface
{
  name = 'AddVersionToDeployedExecutionMetrics1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "deployed_execution_metrics"
      ADD COLUMN IF NOT EXISTS "deployedWorkflowVersion" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      UPDATE "deployed_execution_metrics" metric
      SET "deployedWorkflowVersion" = deployment."version"
      FROM "deployed_workflows" deployment
      WHERE deployment."id" = metric."deployedWorkflowId"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_deployed_execution_metric_deployment_version"
        ON "deployed_execution_metrics" ("deployedWorkflowId", "deployedWorkflowVersion")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_deployed_execution_metric_deployment_version"
    `);

    await queryRunner.query(`
      ALTER TABLE "deployed_execution_metrics"
      DROP COLUMN IF EXISTS "deployedWorkflowVersion"
    `);
  }
}
