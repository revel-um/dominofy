import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeProps, useEdges } from 'reactflow';
import { Hash, MessageSquareText, Slack } from 'lucide-react';
import { useRouter, NextRouter } from 'next/router';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { SlackApi, SlackConnection } from '@/apis/slack.apis';
import SearchableSelect from '@/components/searchableDropdown';
import dominoCatalog from './dominos';

interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
  isPrivate: boolean;
}

type SlackActionNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    setFieldValue?: (heading: string, newValue: unknown) => void;
  };
};

const slackMeta = dominoCatalog.find((entry) => entry.id === 'slackaction');
const slackAccentColor = slackMeta?.badgeStyle?.background
  ? String(slackMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

export default function SlackActionDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isPreviewMode = Boolean(
    (data as DominoNodeData & { previewMode?: boolean }).previewMode
  );

  const router: NextRouter = useRouter();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const edges = useEdges();
  const bootstrappedRef = useRef(false);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading
      ),
    [data.details]
  );

  const vaultId = String(getField('vaultId')?.value ?? '');
  const channelId = String(getField('channelId')?.value ?? '');
  const textValue = String(getField('text')?.value ?? '');

  const [connections, setConnections] = useState<SlackConnection[]>([]);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === vaultId),
    [connections, vaultId]
  );
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === channelId),
    [channels, channelId]
  );

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;

    const setFieldValue = (heading: string, newValue: unknown) => {
      data.setNodes?.((nodes: SlackActionNodeRecord[]) =>
        nodes.map((node: SlackActionNodeRecord) =>
          node.id === id
            ? {
              ...node,
              data: {
                ...node.data,
                details: {
                  ...node.data.details,
                  fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                    field.heading === heading ? { ...field, value: newValue } : field
                  ),
                },
              },
            }
            : node
        )
      );
    };

    const initialFields: DominoField[] = [
      {
        type: 'dropdown',
        heading: 'vaultId',
        value: '',
        options: [],
        required: true,
        shouldRender: false,
      },
      {
        type: 'dropdown',
        heading: 'channelId',
        value: '',
        options: [],
        required: true,
        shouldRender: false,
      },
      {
        type: 'textInput',
        heading: 'text',
        value: '',
        inPinId: 'value_in',
        required: true,
        shouldRender: false,
      },
    ];

    data.setNodes((prev: SlackActionNodeRecord[]) =>
      prev.map((node: SlackActionNodeRecord) => {
        if (node.id !== id) return node;

        const details = node.data.details as DominoNodeData | undefined;
        const fields = details?.fields ?? [];
        const mergedFields = initialFields.map((initialField) => {
          const existingField = fields.find((field) => field.heading === initialField.heading);
          return existingField ? { ...initialField, ...existingField } : initialField;
        });

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              type: 'SlackAction',
              description: 'Send a message to a Slack channel.',
              isTrigger: false,
              ...(details ?? {}),
              fields: mergedFields,
            } as DominoNodeData,
            exportFields: node.data.exportFields ?? ['vaultId', 'channelId', 'text'],
            setFieldValue: node.data.setFieldValue ?? setFieldValue,
          },
        };
      })
    );

    bootstrappedRef.current = true;
  }, [data, id]);

  const setFieldValue = useCallback(
    (heading: string, value: string) => {
      clearValidationForDominoId(id);
      data.setFieldValue?.(heading, value);
      if (!data.setFieldValue && data.setNodes) {
        data.setNodes((nodes: SlackActionNodeRecord[]) =>
          nodes.map((node: SlackActionNodeRecord) =>
            node.id === id
              ? {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    ...node.data.details,
                    fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                      field.heading === heading ? { ...field, value } : field
                    ),
                  },
                },
              }
              : node
          )
        );
      }
    },
    [clearValidationForDominoId, data, id]
  );

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
        if (mounted) setConnections(Array.isArray(list) ? list : []);
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
      setLoadingChannels(false);
      setChannels([]);
      return;
    }

    if (!vaultId) {
      setChannels([]);
      setLoadingChannels(false);
      return;
    }

    let mounted = true;
    (async () => {
      setLoadingChannels(true);
      try {
        const list = await SlackApi.getChannels(token, router, vaultId);
        if (mounted) setChannels(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error('Error fetching Slack channels', error);
      } finally {
        if (mounted) setLoadingChannels(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isPreviewMode, vaultId, token, router]);

  const startOAuth = async () => {
    const url = await SlackApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const isTextConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${hasError
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
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={
              slackAccentColor
                ? {
                  borderColor: slackAccentColor,
                  backgroundColor: `${slackAccentColor}22`,
                }
                : undefined
            }
          >
            <Slack
              className="h-4 w-4"
              style={
                slackAccentColor
                  ? { color: slackAccentColor }
                  : slackMeta?.iconStyle
              }
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Slack Action
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Action
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-5 pb-5 pt-5">
        <div className="space-y-4 px-4 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Slack className="h-3 w-3" />
              Workspace
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Slack
            </span>
          </div>

          <button
            type="button"
            className="w-full rounded-lg border border-transparent bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            onClick={startOAuth}
          >
            {connections.length === 0 ? 'Connect Slack' : 'Add Slack connection'}
          </button>

          {loadingConns ? (
            <div className="rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              Loading Slack connections…
            </div>
          ) : connections.length > 0 ? (
            <div className="space-y-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Active workspace
              </div>
              <div className="rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-1 py-1 dark:border-slate-600 dark:bg-dominofy-dark-surface">
                <SearchableSelect
                  value={vaultId}
                  onChange={(newVaultId) => setFieldValue('vaultId', newVaultId)}
                  placeholder="Select workspace"
                  options={connections.map((connection) => ({
                    label: connection.name,
                    value: connection.id,
                  }))}
                />
              </div>
              {selectedConnection && (
                <div className="text-xs text-foreground/55 dark:text-slate-400">
                  Connected to {selectedConnection.name}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              Connect Slack to send messages from this workflow.
            </div>
          )}
        </div>

        {vaultId && (
          <div className="space-y-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Hash className="h-3 w-3" />
                Channel
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Destination
              </span>
            </div>

            {loadingChannels ? (
              <div className="rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                Loading channels…
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-1 py-1 dark:border-slate-600 dark:bg-dominofy-dark-surface">
                  <SearchableSelect
                    value={channelId}
                    onChange={(newChannelId) => setFieldValue('channelId', newChannelId)}
                    placeholder="Select channel"
                    options={channels.map((channel) => ({
                      label: channel.name,
                      value: channel.id,
                    }))}
                  />
                </div>
                {selectedChannel && (
                  <div className="text-xs text-foreground/55 dark:text-slate-400">
                    Posting in #{selectedChannel.name}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-4">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <MessageSquareText className="h-3 w-3" />
              Message
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isTextConnected ? 'Live input' : 'Static input'}
            </span>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 px-4">
              <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
              <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                {isTextConnected ? (
                  <div className="flex h-full min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                    Connected
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Hello from Dominofy!"
                    value={textValue}
                    onChange={(event) => setFieldValue('text', event.target.value)}
                    className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none transition placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative px-4 pb-4 pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Slack message payload
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
