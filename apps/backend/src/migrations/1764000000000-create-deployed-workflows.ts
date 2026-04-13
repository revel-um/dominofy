import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeployedWorkflows1764000000000 implements MigrationInterface {
  name = 'CreateDeployedWorkflows1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deployed_workflows" (
        "id"          uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "isActive"    boolean           NOT NULL DEFAULT true,
        "createdAt"   TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP         NOT NULL DEFAULT now(),
        "workflowId"  uuid              NOT NULL,
        "visualJson"  jsonb             NOT NULL,
        "version"     integer           NOT NULL DEFAULT 1,
        "isDeployed"  boolean           NOT NULL DEFAULT true,
        CONSTRAINT "PK_deployed_workflows" PRIMARY KEY ("id"),
        CONSTRAINT "FK_deployed_workflows_workflow"
          FOREIGN KEY ("workflowId")
          REFERENCES "workflows"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_deployed_workflow"
        ON "deployed_workflows" ("workflowId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_deployed_active"
        ON "deployed_workflows" ("workflowId", "isDeployed")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "deployed_workflows"`);
  }
}
