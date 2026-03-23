// data-source.ts (or src/data-source.ts)
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './user/user.entity';
import { Project } from './projects/projects.entity';
import { Workflow } from './workflow/workflow.entity';
import { Asset } from './gcs/gcs.entity';
import { Vault } from './vault/vault.entity';
import { WorkflowRevision } from './workflow-revision/workflow-revision.entity';
import { Schedule } from './scheduler/scheduler.entity';
import { Workspace } from './workspace/workspace.entity';
import { WorkspaceMembership } from './workspace/workspace-membership.entity';
import { Collection } from './storage/collection.entity';
import { Document } from './storage/document.entity';

// Load environment variables
dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  schema: process.env.DATABASE_SCHEMA,
  entities: [
    User,
    Project,
    Workflow,
    Asset,
    Vault,
    WorkflowRevision,
    Schedule,
    Workspace,
    WorkspaceMembership,
    Collection,
    Document,
  ],
  migrations: ['src/migrations/*.ts'], // or compiled JS if you're using dist
  // synchronize: false,
  migrationsRun: true,
  logging: true,
});
