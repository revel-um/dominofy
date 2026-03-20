import { WorkspaceRole } from 'src/workspace/workspace-membership.entity';

export const STORAGE_READ_ROLES = Object.values(WorkspaceRole);

export const STORAGE_WRITE_ROLES = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
];

export const STORAGE_RLS_TODO =
  'TODO: When Dominofy has request-scoped workspace DB session context, move this tenant guard into Postgres RLS and per-request SET LOCAL state.';
