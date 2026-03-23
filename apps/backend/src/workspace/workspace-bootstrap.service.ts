import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WorkspaceService } from './workspace.service';

@Injectable()
export class WorkspaceBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkspaceBootstrapService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async onApplicationBootstrap() {
    await this.backfillExistingWorkspaceData();
  }

  private async backfillExistingWorkspaceData() {
    await this.dataSource.transaction(async (manager) => {
      const users: Array<{ id: string; name: string | null; email: string }> =
        await manager.query(`
          SELECT "id", "name", "email"
          FROM "users"
        `);

      for (const user of users) {
        const existingWorkspace = await manager.query(
          `
            SELECT "id"
            FROM "workspaces"
            WHERE "createdById" = $1
            LIMIT 1
          `,
          [user.id],
        );

        let workspaceId = existingWorkspace[0]?.id as string | undefined;

        if (!workspaceId) {
          const created = await this.workspaceService.createWorkspaceWithOwner(
            {
              name: `${user.name?.trim() || user.email.split('@')[0]}'s Workspace`,
            },
            user.id,
            manager,
          );
          workspaceId = created.workspace.id;
        } else {
          await manager.query(
            `
              INSERT INTO "workspace_memberships"
                ("id", "isActive", "createdAt", "updatedAt", "workspaceId", "userId", "role")
              SELECT gen_random_uuid(), true, now(), now(), $1, $2, 'owner'
              WHERE NOT EXISTS (
                SELECT 1
                FROM "workspace_memberships"
                WHERE "workspaceId" = $1 AND "userId" = $2
              )
            `,
            [workspaceId, user.id],
          );
        }

        await manager.query(
          `
            UPDATE "projects"
            SET "workspaceId" = $1
            WHERE "userId" = $2 AND "workspaceId" IS NULL
          `,
          [workspaceId, user.id],
        );
      }
    });

    this.logger.log('Workspace backfill completed');
  }
}
