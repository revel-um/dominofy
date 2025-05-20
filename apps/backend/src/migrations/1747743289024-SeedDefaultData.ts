import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedDefaultData1747743289024 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.startTransaction();
        try {
            // 1. Insert user
            const user = await queryRunner.manager.query(`
        INSERT INTO users (id, name, email, password, "isDefault", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), 'Default', 'default@dominofy.com', 'defaultpass', true, NOW(), NOW())
        RETURNING id
      `);
            const userId = user[0].id;

            // 2. Insert project
            const project = await queryRunner.manager.query(`
        INSERT INTO projects (id, name, description, "userId", "isDefault", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), 'Default Project', 'Auto-created starter project', $1, true, NOW(), NOW())
        RETURNING id
      `, [userId]);
            const projectId = project[0].id;

            // 3. Insert workflow
            await queryRunner.manager.query(`
        INSERT INTO workflows (id, name, "userId", "projectId", "visualJson", "isPublished", "isDefault", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          'Project 1',
          $1,
          $2,
          '{"nodes":[],"edges":[]}'::jsonb,
          false,
          true,
          NOW(),
          NOW()
        )
      `, [userId, projectId]);

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM workflows WHERE isDefault = true`);
        await queryRunner.query(`DELETE FROM projects WHERE isDefault = true`);
        await queryRunner.query(`DELETE FROM users WHERE isDefault = true`);
    }

}
