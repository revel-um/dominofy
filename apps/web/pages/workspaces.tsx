import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Fragment } from 'react';
import { FiArrowRight, FiCheckCircle, FiMail, FiPlus, FiShield, FiUsers } from 'react-icons/fi';
import {
  WorkspaceApi,
  WorkspaceListItem,
  WorkspaceMember,
} from '../apis/workspace.apis';
import { WorkspaceDirectoryList } from '../components/workspaceDirectoryList';
import { TokenManager } from '../utils/auth';
import {
  getActiveWorkspaceIdFromStorage,
  setActiveWorkspaceIdInStorage,
} from '../utils/workspace';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WORKSPACE_PREVIEW_COUNT = 5;
const MEMBERS_PAGE_SIZE = 25;

function getReadableErrorMessage(input: unknown, fallback: string): string {
  if (!input) return fallback;
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    const parts = input
      .map((item) => getReadableErrorMessage(item, ''))
      .filter(Boolean);
    return parts.length ? parts.join(', ') : fallback;
  }
  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (Array.isArray(record.message)) {
      return getReadableErrorMessage(record.message, fallback);
    }
    if (record.constraints && typeof record.constraints === 'object') {
      const values = Object.values(record.constraints).filter((value): value is string => typeof value === 'string');
      if (values.length) return values.join(', ');
    }
    if (Array.isArray(record.children) && record.children.length) {
      return getReadableErrorMessage(record.children, fallback);
    }
  }
  return fallback;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);
  const [membersByWorkspace, setMembersByWorkspace] = useState<Record<string, WorkspaceMember[]>>({});
  const [memberPagingByWorkspace, setMemberPagingByWorkspace] = useState<Record<string, { count: number; hasMore: boolean; offset: number }>>({});
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteError, setInviteError] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [workspaceListMode, setWorkspaceListMode] = useState<'owned' | 'invited'>('owned');
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);

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
  const canInvite = selectedWorkspace
    ? ['owner', 'admin'].includes(selectedWorkspace.role)
    : false;
  const previewOwnedWorkspaces = ownedWorkspaces.slice(0, WORKSPACE_PREVIEW_COUNT);
  const previewInvitedWorkspaces = invitedWorkspaces.slice(0, WORKSPACE_PREVIEW_COUNT);
  const previewWorkspaces = workspaceListMode === 'owned' ? previewOwnedWorkspaces : previewInvitedWorkspaces;
  const selectedWorkspaceMembers = selectedWorkspaceId
    ? membersByWorkspace[selectedWorkspaceId] ?? []
    : [];
  const isSelectedWorkspaceCurrent = selectedWorkspace?.id === currentWorkspaceId;
  const isSelectedWorkspaceMembersCached = selectedWorkspaceId
    ? Object.prototype.hasOwnProperty.call(membersByWorkspace, selectedWorkspaceId)
    : false;
  const selectedWorkspacePaging = selectedWorkspaceId
    ? memberPagingByWorkspace[selectedWorkspaceId] ?? { count: 0, hasMore: false, offset: 0 }
    : { count: 0, hasMore: false, offset: 0 };

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

  const loadMembers = useCallback(async (workspaceId: string, options?: { force?: boolean; append?: boolean }) => {
    const hasCachedMembers = Object.prototype.hasOwnProperty.call(membersByWorkspace, workspaceId);
    if (hasCachedMembers && !options?.force && !options?.append) {
      return;
    }

    const token = await TokenManager.getValidAccessToken();
    if (!token) return;

    const paging = memberPagingByWorkspace[workspaceId] ?? { count: 0, hasMore: true, offset: 0 };
    const offset = options?.append ? paging.offset : 0;
    if (options?.append && !paging.hasMore) {
      return;
    }

    setIsMembersLoading(true);
    try {
      const response = await WorkspaceApi.getWorkspaceMembers(workspaceId, token, router, {
        limit: MEMBERS_PAGE_SIZE,
        offset,
      });
      if (!response?.ok) return;
      const payload = (await response.json()) as {
        data: WorkspaceMember[];
        count: number;
        hasMore: boolean;
        offset: number;
        limit: number;
      };
      const list = payload?.data ?? [];
      setMembersByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: options?.append ? [...(prev[workspaceId] ?? []), ...list] : list,
      }));
      setMemberPagingByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: {
          count: payload?.count ?? list.length,
          hasMore: Boolean(payload?.hasMore),
          offset: (payload?.offset ?? offset) + list.length,
        },
      }));
    } catch (error) {
      console.error('Failed to load workspace members:', error);
      toast.error('Failed to load workspace members');
    } finally {
      setIsMembersLoading(false);
    }
  }, [memberPagingByWorkspace, membersByWorkspace, router]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      return;
    }
    loadMembers(selectedWorkspaceId);
  }, [selectedWorkspaceId, loadMembers]);

  useEffect(() => {
    const element = detailsScrollRef.current;
    if (!element || !selectedWorkspaceId) return;

    const handleScroll = () => {
      const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
      if (remaining > 120 || isMembersLoading || !selectedWorkspacePaging.hasMore) {
        return;
      }
      loadMembers(selectedWorkspaceId, { append: true });
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [isMembersLoading, loadMembers, selectedWorkspaceId, selectedWorkspacePaging.hasMore]);

  const handleSwitchWorkspace = (workspaceId: string) => {
    setActiveWorkspaceIdInStorage(workspaceId);
    setCurrentWorkspaceId(workspaceId);
    setSelectedWorkspaceId(workspaceId);
    router.push(`/dashboard?workspaceId=${workspaceId}`);
  };

  const handleInvite = async () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!selectedWorkspace) return;
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setInviteError('Enter a valid email address.');
      return;
    }

    setInviteError('');
    setIsInviting(true);
    try {
      const token = await TokenManager.getValidAccessToken();
      if (!token) {
        router.push('/auth');
        return;
      }

      const response = await WorkspaceApi.inviteWorkspaceMember(
        selectedWorkspace.id,
        { email: normalizedEmail, role: inviteRole },
        token,
        router,
      );

      if (!response) {
        setInviteError('Failed to invite member.');
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setInviteError(getReadableErrorMessage(payload?.message ?? payload, 'Failed to invite member.'));
        return;
      }

      setInviteEmail('');
      setInviteRole('member');
      toast.success('Workspace member invited');
      loadMembers(selectedWorkspace.id, { force: true });
      loadWorkspaces();
    } catch (error) {
      console.error('Failed to invite workspace member:', error);
      setInviteError('Failed to invite member.');
    } finally {
      setIsInviting(false);
    }
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
              {selectedWorkspace ? (
                <div ref={detailsScrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
                        Selected workspace
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                        {selectedWorkspace.name}
                      </h2>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Role: <span className="font-medium text-slate-800 dark:text-slate-200">{selectedWorkspace.role}</span>
                      </p>
                    </div>
                    {!isSelectedWorkspaceCurrent && (
                      <button
                        type="button"
                        onClick={() => handleSwitchWorkspace(selectedWorkspace.id)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-[18px] bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                      >
                        Switch workspace
                        <FiArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-[22px] border border-slate-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-slate-950/35">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Projects</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{selectedWorkspace.projectCount}</p>
                    </div>
                    <div className="rounded-[22px] border border-slate-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-slate-950/35">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Members</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{selectedWorkspace.memberCount}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center gap-2">
                      <FiMail className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
                        Invite members
                      </h3>
                    </div>
                    {canInvite ? (
                      <div className="mt-4 space-y-3">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(event) => {
                            setInviteEmail(event.target.value);
                            setInviteError('');
                          }}
                          placeholder="name@example.com"
                          className="min-h-[48px] w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                        />
                        <select
                          value={inviteRole}
                          onChange={(event) => setInviteRole(event.target.value)}
                          className="min-h-[48px] w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {inviteError ? (
                          <p className="text-sm text-rose-600 dark:text-rose-300">{inviteError}</p>
                        ) : (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Only owners and admins can invite members. If the email is not registered yet, Dominofy will send an invitation to create an account and join this workspace.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={handleInvite}
                          disabled={isInviting}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[18px] bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isInviting ? 'Inviting...' : 'Send invite'}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-[18px] border border-dashed border-slate-300/70 px-4 py-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        Only workspace owners and admins can invite people into this workspace.
                      </p>
                    )}
                  </div>
                  <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-white/10">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Workspace members</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Everyone currently attached to the selected workspace.</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        {selectedWorkspacePaging.count || selectedWorkspaceMembers.length} members
                      </span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {isMembersLoading && selectedWorkspaceMembers.length === 0 && !isSelectedWorkspaceMembersCached ? (
                        <div className="flex items-center justify-center py-10">
                          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-500" />
                        </div>
                      ) : selectedWorkspaceMembers.length === 0 ? (
                        <p className="rounded-[22px] border border-dashed border-slate-300/70 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                          No members found for this workspace.
                        </p>
                      ) : selectedWorkspaceMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-slate-950/35"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{member.name}</p>
                            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{member.email}</p>
                          </div>
                            <div className="flex items-center gap-2">
                              {member.acceptanceStatus === 'pending' && (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                  Pending
                                </span>
                              )}
                              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                                {member.role}
                              </span>
                            {selectedWorkspace?.createdById === member.userId && (
                              <FiCheckCircle className="h-4 w-4 text-emerald-500" title="Workspace owner" />
                            )}
                          </div>
                        </div>
                      ))}
                      {isMembersLoading && selectedWorkspaceMembers.length > 0 && (
                        <div className="flex items-center justify-end px-1 pt-1">
                          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            <div className="h-3 w-3 animate-spin rounded-full border border-sky-500 border-t-transparent" />
                            Loading more members
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Select a workspace to view details.</p>
              )}
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
