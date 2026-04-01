import React, { useEffect, useMemo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { useRouter, NextRouter } from 'next/router';
import {
  BellRing,
  Hash,
  ShieldCheck,
  Slack,
  UserPlus,
} from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { SlackApi, SlackConnection } from '@/apis/slack.apis';
import SearchableSelect from '@/components/searchableDropdown';
import dominoCatalog from './dominos';

interface SlackTriggerData extends DominoNodeData {
  slackTeamId?: string;
  vaultId?: string;
  slackChannelId?: string;
}

interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
  isPrivate: boolean;
}

const slackTriggerMeta = dominoCatalog.find((entry) => entry.id === 'slacktrigger');
const slackTriggerAccentColor = slackTriggerMeta?.badgeStyle?.background
  ? String(slackTriggerMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#2563eb';

export default function SlackTriggerDomino({
  data,
  id,
  selected,
}: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isPreviewMode = Boolean((data as any).previewMode);

  const router: NextRouter = useRouter();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const vaultId: string =
    (data as SlackTriggerData).vaultId || (data as any).connectionId || '';
  const slackChannelId: string =
    (data as SlackTriggerData).slackChannelId || (data as any).channel || '';

  const [connections, setConnections] = useState<SlackConnection[]>([]);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedCh, setSelectedCh] = useState<SlackChannel | null>(null);
  const [loadingConns, setLoadingConns] = useState(true);
  const [loadingCh, setLoadingCh] = useState(false);
  const [inviting, setInviting] = useState(false);

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === vaultId) || null,
    [connections, vaultId]
  );

  useEffect(() => {
    if (!data.setNodes) return;

    if (!('vaultId' in data) && !('slackChannelId' in data)) {
      const init: DominoNodeData = {
        type: 'SlackTrigger',
        description:
          'Triggers when a new message is posted in the selected Slack channel.',
        isTrigger: true,
        fields: [],
      };

      data.setNodes((nodes: any[]) =>
        nodes.map((node: { id: string; data: any }) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  details: init,
                  exportFields: [],
                  vaultId: '',
                  slackChannelId: '',
                },
              }
            : node
        )
      );
    }
  }, [data, id]);

  useEffect(() => {
    if (isPreviewMode) {
      setLoadingConns(false);
      setConnections([]);
      return;
    }

    let mounted = true;
    (async () => {
      setLoadingConns(true);
      try {
        const list = await SlackApi.getConnections(token, router);
        if (mounted) setConnections(list ?? []);
      } catch (error) {
        console.error('Error fetching Slack connections', error);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isPreviewMode, token, router]);

  useEffect(() => {
    if (isPreviewMode) {
      setLoadingCh(false);
      setChannels([]);
      setSelectedCh(null);
      return;
    }

    if (!vaultId) {
      setChannels([]);
      setSelectedCh(null);
      setLoadingCh(false);
      return;
    }

    let mounted = true;
    (async () => {
      setLoadingCh(true);
      try {
        const list = await SlackApi.getChannels(token, router, vaultId);
        if (mounted) {
          setChannels(list ?? []);
          const channel = (list ?? []).find((entry) => entry.id === slackChannelId) || null;
          setSelectedCh(channel);
        }
      } catch (error) {
        console.error('Error fetching Slack channels', error);
      } finally {
        if (mounted) setLoadingCh(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isPreviewMode, vaultId, slackChannelId, token, router]);

  const startOAuth = async () => {
    const url = await SlackApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const updateVaultId = (newVaultId: string) => {
    const nextConnection = connections.find((connection) => connection.id === newVaultId);

    data.setNodes?.((nodes: any[]) =>
      nodes.map((node: { id: string; data: SlackTriggerData }) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                vaultId: newVaultId,
                slackTeamId: nextConnection?.slackTeamId || '',
                slackChannelId: '',
              } as SlackTriggerData,
            }
          : node
      )
    );
  };

  const updateChannelId = (channelId: string) => {
    const channel = channels.find((entry) => entry.id === channelId) || null;
    setSelectedCh(channel);

    data.setNodes?.((nodes: any[]) =>
      nodes.map((node: { id: string; data: SlackTriggerData }) =>
        node.id === id
          ? {
              ...node,
              data: { ...node.data, slackChannelId: channelId } as SlackTriggerData,
            }
          : node
      )
    );
  };

  const inviteBot = async () => {
    if (!selectedCh || selectedCh.isMember || selectedCh.isPrivate) return;

    setInviting(true);
    try {
      const ok = await SlackApi.inviteBot(token, router, vaultId, selectedCh.id);
      if (ok) {
        const list = await SlackApi.getChannels(token, router, vaultId);
        setChannels(list ?? []);
        setSelectedCh((list ?? []).find((entry) => entry.id === selectedCh.id) || null);
      }
    } catch (error) {
      console.error('Invite bot error', error);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 shadow-sm backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
      } hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{
              borderColor: slackTriggerAccentColor,
              backgroundColor: `${slackTriggerAccentColor}22`,
            }}
          >
            <Slack className="h-4 w-4" style={{ color: slackTriggerAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Slack Trigger
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Channel Listener
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Status
              </div>
              <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                {loadingConns
                  ? 'Loading Slack connections'
                  : selectedConnection && selectedCh
                    ? `Watching #${selectedCh.name}`
                    : selectedConnection
                      ? `Select a channel for ${selectedConnection.name}`
                      : 'Connect Slack to activate this trigger'}
              </div>
            </div>
            <span className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {selectedCh ? 'Active config' : 'Setup needed'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Slack className="h-3.5 w-3.5" />
              Connection
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {connections.length} workspace{connections.length === 1 ? '' : 's'}
            </span>
          </div>

          <button
            type="button"
            className="w-full rounded-lg border border-sky-500/30 bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={startOAuth}
            disabled={loadingConns}
          >
            {connections.length === 0 ? 'Connect Slack' : 'Add Slack connection'}
          </button>

          {loadingConns ? (
            <div className="rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm text-foreground/70 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-300">
              Loading Slack connections...
            </div>
          ) : connections.length > 0 ? (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Slack Workspace
              </label>
              <SearchableSelect
                value={vaultId}
                onChange={updateVaultId}
                placeholder="Select workspace"
                options={connections.map((connection) => ({
                  label: connection.name,
                  value: connection.id,
                }))}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm text-foreground/65 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-400">
              No Slack workspaces connected yet. Authorize Slack to start listening for messages.
            </div>
          )}
        </div>

        {vaultId && connections.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Hash className="h-3.5 w-3.5" />
                Channel
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                {loadingCh ? 'Loading' : selectedCh ? 'Selected' : 'Required'}
              </span>
            </div>

            {loadingCh ? (
              <div className="rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm text-foreground/70 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-300">
                Loading channels...
              </div>
            ) : (
              <div className="space-y-3">
                <SearchableSelect
                  value={slackChannelId}
                  onChange={updateChannelId}
                  placeholder="Select channel"
                  options={channels.map((channel) => ({
                    label: channel.name,
                    value: channel.id,
                  }))}
                />

                {selectedCh && !selectedCh.isMember && (
                  selectedCh.isPrivate ? (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                      Private channel. Ask a member to invite the bot with
                      <code className="ml-1 rounded bg-black/5 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
                        /invite &lt;bot&gt;
                      </code>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={inviteBot}
                      disabled={inviting}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>{inviting ? 'Inviting...' : 'Invite bot to channel'}</span>
                    </button>
                  )
                )}

                {selectedCh && (
                  <div className="rounded-lg border border-black/5 bg-black/[0.02] px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground dark:text-slate-200">
                          #{selectedCh.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-foreground/55 dark:text-slate-400">
                          {selectedCh.isPrivate
                            ? 'Private channel'
                            : 'Public channel'}{' '}
                          • {selectedCh.isMember ? 'Bot can read messages' : 'Bot not in channel yet'}
                        </div>
                      </div>
                      <BellRing className="h-4 w-4 shrink-0 text-foreground/40 dark:text-slate-500" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Trigger Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Slack payload
            </span>
          </div>

          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Incoming message event
                </div>
              </div>
            </div>
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
          </div>
        </div>
      </div>
    </div>
  );
}
