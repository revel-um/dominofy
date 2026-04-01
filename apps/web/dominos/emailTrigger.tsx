import React, { useEffect, useMemo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { useRouter, NextRouter } from 'next/router';
import { Inbox, MailCheck, MailPlus, ShieldCheck, UserRoundSearch } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import SearchableSelect from '@/components/searchableDropdown';
import { EmailApi, EmailConnection } from '@/apis/email.apis';
import dominoCatalog from './dominos';

interface EmailTriggerData extends DominoNodeData {
  vaultId?: string;
  inboxAddress?: string;
  senderAddress?: string;
}

const emailTriggerMeta = dominoCatalog.find((entry) => entry.id === 'emailtrigger');
const emailTriggerAccentColor = emailTriggerMeta?.badgeStyle?.background
  ? String(emailTriggerMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : '#38bdf8';

export default function EmailTriggerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isPreviewMode = Boolean((data as any).previewMode);

  const router: NextRouter = useRouter();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const vaultId: string =
    (data as EmailTriggerData).vaultId || (data as any).vaultId || '';
  const inboxAddress: string =
    (data as EmailTriggerData).inboxAddress ||
    (data as any).inboxAddress ||
    '';
  const senderAddress: string =
    (data as EmailTriggerData).senderAddress ||
    (data as any).senderAddress ||
    '';

  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const safeConnections = Array.isArray(connections) ? connections : [];
  const selectedConn = useMemo(
    () => safeConnections.find((connection) => connection.id === vaultId),
    [safeConnections, vaultId]
  );

  useEffect(() => {
    if (!data.setNodes) return;
    if (
      !('vaultId' in data) &&
      !('inboxAddress' in data) &&
      !('senderAddress' in data)
    ) {
      const init: DominoNodeData = {
        type: 'EmailTrigger',
        description: 'Triggers when a Gmail inbox receives a new email.',
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
                  inboxAddress: '',
                  senderAddress: '',
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
        const list = await EmailApi.getConnections(token, router);
        if (mounted) setConnections(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error('Error fetching email connections', error);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isPreviewMode, token, router]);

  const startOAuth = async () => {
    const url = await EmailApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const updateVaultId = (newVaultId: string) => {
    clearValidationForDominoId?.(id);
    data.setNodes?.((nodes: any[]) =>
      nodes.map((node: { id: string; data: any }) =>
        node.id === id
          ? { ...node, data: { ...node.data, vaultId: newVaultId } }
          : node
      )
    );
  };

  const updateInbox = (addr: string) => {
    clearValidationForDominoId?.(id);
    const cleaned = addr.trim().toLowerCase();
    data.setNodes?.((nodes: any[]) =>
      nodes.map((node: { id: string; data: any }) =>
        node.id === id
          ? { ...node, data: { ...node.data, inboxAddress: cleaned } }
          : node
      )
    );
  };

  const updateSender = (addr: string) => {
    clearValidationForDominoId?.(id);
    const cleaned = addr.trim().toLowerCase();
    data.setNodes?.((nodes: any[]) =>
      nodes.map((node: { id: string; data: any }) =>
        node.id === id
          ? { ...node, data: { ...node.data, senderAddress: cleaned } }
          : node
      )
    );
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
              borderColor: emailTriggerAccentColor,
              backgroundColor: `${emailTriggerAccentColor}22`,
            }}
          >
            <MailCheck className="h-4 w-4" style={{ color: emailTriggerAccentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Email Trigger
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Gmail Listener
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
                  ? 'Loading Gmail connections'
                  : selectedConn
                    ? `Watching ${selectedConn.email || selectedConn.name}`
                    : 'Connect Gmail to activate this trigger'}
              </div>
            </div>
            <span className="rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {selectedConn ? 'Active config' : 'Setup needed'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <MailPlus className="h-3.5 w-3.5" />
              Connection
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {safeConnections.length} account{safeConnections.length === 1 ? '' : 's'}
            </span>
          </div>

          <button
            type="button"
            className="w-full rounded-lg border border-sky-500/30 bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={startOAuth}
            disabled={loadingConns}
          >
            {safeConnections.length === 0 ? 'Connect Gmail' : 'Add Gmail connection'}
          </button>

          {loadingConns ? (
            <div className="rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm text-foreground/70 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-300">
              Loading Gmail connections...
            </div>
          ) : safeConnections.length > 0 ? (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Gmail Account
              </label>
              <SearchableSelect
                value={vaultId}
                onChange={updateVaultId}
                placeholder="Select account"
                options={safeConnections.map((connection) => ({
                  label: connection.email || connection.name,
                  value: connection.id,
                }))}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300/80 bg-dominofy-light-surface px-4 py-3 text-sm text-foreground/65 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-400">
              No Gmail connections found yet. Connect an inbox to start listening for mail.
            </div>
          )}
        </div>

        {vaultId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Inbox className="h-3.5 w-3.5" />
                Inbox Filter
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Optional
              </span>
            </div>

            <div className="min-h-11 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
              <input
                type="text"
                placeholder={selectedConn?.email || 'you@gmail.com'}
                value={inboxAddress}
                onChange={(event) => updateInbox(event.target.value)}
                className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
              />
            </div>

            <p className="text-[11px] leading-relaxed text-foreground/55 dark:text-slate-400">
              Leave blank to trigger on any email received by the selected Gmail account.
            </p>
          </div>
        )}

        {vaultId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <UserRoundSearch className="h-3.5 w-3.5" />
                Sender Filter
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Optional
              </span>
            </div>

            <div className="min-h-11 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
              <input
                type="text"
                placeholder="sender@example.com"
                value={senderAddress}
                onChange={(event) => updateSender(event.target.value)}
                className="nodrag h-full min-h-11 w-full rounded-lg bg-transparent px-4 py-2.5 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
              />
            </div>

            <p className="text-[11px] leading-relaxed text-foreground/55 dark:text-slate-400">
              Leave blank to allow messages from any sender. Use a full email address for a strict match.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Trigger Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Email payload
            </span>
          </div>

          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Incoming email details
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
