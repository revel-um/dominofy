import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { FiArrowRight, FiCheckCircle, FiMail } from 'react-icons/fi';
import { WorkspaceApi, WorkspaceListItem, WorkspaceMember } from '../apis/workspace.apis';
import { TokenManager } from '../utils/auth';
import DominoDropdown from './shared/dominoDropdown';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

interface SelectedWorkspacePanelProps {
  selectedWorkspace: WorkspaceListItem | null;
  currentWorkspaceId: string | null;
  onSwitchWorkspace: (workspaceId: string) => void;
  onWorkspaceUpdated?: () => void | Promise<void>;
  className?: string;
}

export function SelectedWorkspacePanel({
  selectedWorkspace,
  currentWorkspaceId,
  onSwitchWorkspace,
  onWorkspaceUpdated,
  className = '',
}: SelectedWorkspacePanelProps) {
  const router = useRouter();
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);
  const [membersByWorkspace, setMembersByWorkspace] = useState<Record<string, WorkspaceMember[]>>({});
  const [memberPagingByWorkspace, setMemberPagingByWorkspace] = useState<Record<string, { count: number; hasMore: boolean; offset: number }>>({});
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteError, setInviteError] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const selectedWorkspaceId = selectedWorkspace?.id ?? null;
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
  const canInvite = selectedWorkspace
    ? ['owner', 'admin'].includes(selectedWorkspace.role)
    : false;

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
    if (!selectedWorkspaceId) return;
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

  useEffect(() => {
    setInviteEmail('');
    setInviteRole('member');
    setInviteError('');
  }, [selectedWorkspaceId]);

  const handleInvite = useCallback(async () => {
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
      await loadMembers(selectedWorkspace.id, { force: true });
      await onWorkspaceUpdated?.();
    } catch (error) {
      console.error('Failed to invite workspace member:', error);
      setInviteError('Failed to invite member.');
    } finally {
      setIsInviting(false);
    }
  }, [inviteEmail, inviteRole, loadMembers, onWorkspaceUpdated, router, selectedWorkspace]);

  if (!selectedWorkspace) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">Select a workspace to view details.</p>
    );
  }

  return (
    <div ref={detailsScrollRef} className={`min-h-0 flex-1 overflow-y-auto pr-1 pb-2 ${className}`}>
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
            onClick={() => onSwitchWorkspace(selectedWorkspace.id)}
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
            <DominoDropdown
              value={inviteRole}
              onChange={setInviteRole}
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'Member', value: 'member' },
                { label: 'Viewer', value: 'viewer' },
              ]}
              placeholder="Role"
              className="min-h-[48px] w-full rounded-[18px] border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
              menuWidthClassName="w-full"
            />
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
  );
}

export default SelectedWorkspacePanel;
