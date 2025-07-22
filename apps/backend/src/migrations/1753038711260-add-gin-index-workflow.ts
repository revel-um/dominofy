// apps/backend/src/migrations/1690224000001-add-gin-index-visualjson.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGinIndexVisualJson1690224000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      /* ----------------------------------------------------------
       *  Generic GIN index on the whole visualJson column.
       *  Works for ANY query that uses @> or jsonb_path_query().
       *  -------------------------------------------------------- */
      CREATE INDEX IF NOT EXISTS idx_workflow_visualjson_gin
      ON workflows
      USING GIN (visualJson jsonb_path_ops);
    `);

        /* Optional: drop the Slack-specific partial index if you
           created it earlier and no longer need it.
           Uncomment if applicable.
    
        await queryRunner.query('DROP INDEX IF EXISTS idx_workflow_slacktrigger_gin;');
        */
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS idx_workflow_visualjson_gin;');
    }
}
