import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWorkflowRevisions1753038711261 implements MigrationInterface {
    name = 'CreateWorkflowRevisions1753038711261'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "workflow_revisions" (
                "rev_id" SERIAL PRIMARY KEY,
                "workflowId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "diff_json" jsonb NOT NULL,
                "ai_prompt" text NOT NULL,
                "ai_explanation" text NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "fk_workflow_revisions_workflow" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_workflow_revisions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
            );
        `);

        // Create index for fast "last-N revisions" queries
        await queryRunner.query(`
            CREATE INDEX "idx_wf_revision_lookup" ON "workflow_revisions" ("workflowId", "created_at" DESC);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS "idx_wf_revision_lookup";');
        await queryRunner.query('DROP TABLE IF EXISTS "workflow_revisions";');
    }
} 