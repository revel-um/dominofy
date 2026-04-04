import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkflowComments1763000000000 implements MigrationInterface {
    name = 'AddWorkflowComments1763000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "workflows"
            ADD COLUMN IF NOT EXISTS "comments" jsonb NOT NULL DEFAULT '[]'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "workflows" DROP COLUMN IF EXISTS "comments"
        `);
    }
}
