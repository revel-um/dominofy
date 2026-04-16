import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Fragment } from 'react';
import { FiPlus, FiShield, FiUsers } from 'react-icons/fi';
import {
  WorkspaceApi,
  WorkspaceListItem,
} from '../apis/workspace.apis';
import { WorkspaceDirectoryList } from '../components/workspaceDirectoryList';
import SelectedWorkspacePanel from '../components/selectedWorkspacePanel';
import { TokenManager } from '../utils/auth';
import {
  getActiveWorkspaceIdFromStorage,
  setActiveWorkspaceIdInStorage,
} from '../utils/workspace';

const WORKSPACE_PREVIEW_COUNT = 5;

function getReadableErrorMessage(input: unknown, fallback: string): string {
  if (!input) return fallback;
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    const parts = input.map((item) => getReadableErrorMessage(item, '')).filter(Boolean);
    return parts.length ? parts.join(', ') : fallback;
  }
  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (Array.isArray(record.message)) return getReadableErrorMessage(record.message, fallback);
    if (record.constraints && typeof record.constraints === 'object') {
      const values = Object.values(record.constraints).filter((value): value is string => typeof value === 'string');
      if (values.length) return values.join(', ');
    }
    if (Array.isArray(record.children) && record.children.length) return getReadableErrorMessage(record.children, fallback);
  }
  return fallback;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [workspaceListMode, setWorkspaceListMode] = useState<'owned' | 'invited'>('owned');

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );
  const ownedWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.isOwnedByUser),
    [workspaces],
  );
  const invitedWorkspaces = useMemo(
    () => workspaces.filter((workspace) => !workspace.isOwnedByUser),
    [workspaces],
  );
  const previewOwnedWorkspaces = ownedWorkspaces.slice(0, WORKSPACE_PREVIEW_COUNT);
  const previewInvitedWorkspaces = invitedWorkspaces.slice(0, WORKSPACE_PREVIEW_COUNT);
  const previewWorkspaces = workspaceListMode === 'owned' ? previewOwnedWorkspaces : previewInvitedWorkspaces;
  const loadWorkspaces = useCallback(async () => {
    const token = await TokenManager.getValidAccessToken();
    if (!token) {
      router.push('/auth');
      return;
    }

    setIsLoading(true);
    try {
      const response = await WorkspaceApi.listWorkspaces(token, router);
      if (!response?.ok) return;

      const list = (await response.json()) as WorkspaceListItem[];
      setWorkspaces(list);

      const requestedWorkspaceId =
        (typeof router.query.workspaceId === 'string' ? router.query.workspaceId : null) ||
        getActiveWorkspaceIdFromStorage();
      const resolvedCurrentWorkspaceId =
        list.find((workspace) => workspace.id === requestedWorkspaceId)?.id ??
        list[0]?.id ??
        null;
      const nextSelected =
        list.find((workspace) => workspace.id === requestedWorkspaceId)?.id ??
        list[0]?.id ??
        null;

      setCurrentWorkspaceId(resolvedCurrentWorkspaceId);
      setSelectedWorkspaceId(nextSelected);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      toast.error('Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleSwitchWorkspace = (workspaceId: string) => {
    setActiveWorkspaceIdInStorage(workspaceId);
    setCurrentWorkspaceId(workspaceId);
    setSelectedWorkspaceId(workspaceId);
    router.push(`/dashboard?workspaceId=${workspaceId}`);
  };

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) {
      setCreateError('Workspace name is required.');
      return;
    }
    if (name.length > 60) {
      setCreateError('Workspace name must be 60 characters or fewer.');
      return;
    }

    setCreateError('');
    setIsCreatingWorkspace(true);
    try {
      const token = await TokenManager.getValidAccessToken();
      if (!token) {
        router.push('/auth');
        return;
      }

      const response = await WorkspaceApi.createWorkspace({ name }, token, router);
      if (!response) {
        setCreateError('Failed to create workspace.');
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setCreateError(getReadableErrorMessage(payload?.message ?? payload, 'Failed to create workspace.'));
        return;
      }

      const createdWorkspace = await response.json() as { id: string };
      setNewWorkspaceName('');
      setIsCreateDialogOpen(false);
      toast.success('Workspace created');
      await loadWorkspaces();
      if (createdWorkspace?.id) {
        setCurrentWorkspaceId(createdWorkspace.id);
        setActiveWorkspaceIdInStorage(createdWorkspace.id);
        setSelectedWorkspaceId(createdWorkspace.id);
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
      setCreateError('Failed to create workspace.');
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] dark:bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)]">
        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] px-4 py-5 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)] sm:px-6 sm:py-6">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/80 px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
                Workspace management
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Manage access and switch context
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                Review workspaces you own, see invitations you have accepted, switch the active workspace, and manage member access where your role allows it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateError('');
                setNewWorkspaceName('');
                setIsCreateDialogOpen(true);
              }}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[18px] bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <FiPlus className="h-4 w-4" />
              Create workspace
            </button>
          </div>
        </section>

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid min-h-0 gap-6">
            <WorkspaceDirectoryList
              title={workspaceListMode === 'owned' ? 'Owned by you' : 'Invited workspaces'}
              description={
                workspaceListMode === 'owned'
                  ? 'Workspaces where you are the creator and owner.'
                  : 'Workspaces shared with you by other people.'
              }
              icon={
                workspaceListMode === 'owned'
                  ? <FiShield className="h-5 w-5" />
                  : <FiUsers className="h-5 w-5" />
              }
              items={previewWorkspaces}
              selectedWorkspaceId={selectedWorkspaceId}
              onSelect={(workspaceId) => {
                if (selectedWorkspaceId === workspaceId) return;
                setSelectedWorkspaceId(workspaceId);
              }}
              emptyMessage={workspaceListMode === 'owned' ? 'No owned workspaces found.' : 'No invited workspaces yet.'}
              badgeTone={workspaceListMode === 'owned' ? 'owned' : 'invited'}
              statusLabel={workspaceListMode === 'owned' ? `${ownedWorkspaces.length} total` : `${invitedWorkspaces.length} total`}
              subHeaderAction={
                <div className="inline-flex rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => setWorkspaceListMode('owned')}
                    className={`inline-flex min-h-[40px] items-center rounded-[14px] px-4 text-sm font-medium transition-all ${
                      workspaceListMode === 'owned'
                        ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    Owned
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceListMode('invited')}
                    className={`inline-flex min-h-[40px] items-center rounded-[14px] px-4 text-sm font-medium transition-all ${
                      workspaceListMode === 'invited'
                        ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] dark:bg-white dark:text-slate-950'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    Invited
                  </button>
                </div>
              }
              headerAction={
                ((workspaceListMode === 'owned' ? ownedWorkspaces.length : invitedWorkspaces.length) > WORKSPACE_PREVIEW_COUNT) ? (
                  <button
                    type="button"
                    onClick={() => router.push('/overview?view=workspace')}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:border-sky-400/35 dark:hover:bg-sky-400/15"
                  >
                    Show all
                  </button>
                ) : null
              }
            />
          </div>

          <div className="grid min-h-0 gap-6 xl:h-full">
            <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
              <SelectedWorkspacePanel
                selectedWorkspace={selectedWorkspace}
                currentWorkspaceId={currentWorkspaceId}
                onSwitchWorkspace={handleSwitchWorkspace}
                onWorkspaceUpdated={loadWorkspaces}
              />
            </section>
          </div>
        </div>
      </div>

      <Transition show={isCreateDialogOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (isCreatingWorkspace) return;
            setIsCreateDialogOpen(false);
          }}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_28%),rgba(15,23,42,0.42)] backdrop-blur-sm dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_24%),rgba(2,6,23,0.72)]" />
          </TransitionChild>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 translate-y-2 scale-95"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-2 scale-95"
            >
              <DialogPanel className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(248,250,252,0.94)_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,_rgba(15,23,42,0.94)_0%,_rgba(2,6,23,0.94)_100%)]">
                <div className="border-b border-slate-200/70 bg-slate-50/70 px-6 py-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <DialogTitle className="text-xl font-semibold text-slate-950 dark:text-white">
                    Create workspace
                  </DialogTitle>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Start a new workspace. You will be assigned as the owner automatically.
                  </p>
                </div>

                <div className="bg-white/60 px-6 py-5 dark:bg-transparent">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Workspace name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={newWorkspaceName}
                    onChange={(event) => {
                      setNewWorkspaceName(event.target.value);
                      setCreateError('');
                    }}
                    placeholder="Awesome workspace"
                    className="mt-3 min-h-[48px] w-full rounded-[18px] border border-slate-200/90 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/55 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-sky-500/10"
                  />
                  {createError ? (
                    <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{createError}</p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      Use a clear name so teammates can recognize it quickly.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200/70 bg-slate-50/70 px-6 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <button
                    type="button"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isCreatingWorkspace}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[18px] border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateWorkspace}
                    disabled={isCreatingWorkspace}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[18px] bg-sky-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingWorkspace ? 'Creating...' : 'Create workspace'}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
