export const ACTIVE_WORKSPACE_STORAGE_KEY = 'dominofy-active-workspace-id';

export function getActiveWorkspaceIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveWorkspaceIdInStorage(workspaceId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (workspaceId) {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
      return;
    }
    localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}
