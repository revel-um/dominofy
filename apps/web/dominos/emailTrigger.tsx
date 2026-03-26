import React, { useEffect, useMemo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { useRouter, NextRouter } from 'next/router';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
import SearchableSelect from '@/components/searchableDropdown';
import { EmailApi, EmailConnection } from '@/apis/email.apis';

interface EmailTriggerData extends DominoNodeData {
  vaultId?: string;
  inboxAddress?: string;
  senderAddress?: string;
}

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
    () => safeConnections.find(c => c.id === vaultId),
    [safeConnections, vaultId],
  );

  /* Initialise node schema on first mount */
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
        nodes.map((n: { id: string; data: any }) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: init,
                  exportFields: [],
                  vaultId: '',
                  inboxAddress: '',
                  senderAddress: '',
                },
              }
            : n,
        ),
      );
    }
  }, [data, id]);

  /* Load Gmail connections */
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
      } catch (err) {
        console.error('Error fetching email connections', err);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();
    return () => void (mounted = false);
  }, [isPreviewMode, token, router]);

  const startOAuth = async () => {
    const url = await EmailApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const updateVaultId = (newVaultId: string) => {
    clearValidationForDominoId?.(id);
    data.setNodes?.((nodes: any[]) =>
      nodes.map((n: { id: string; data: any }) =>
        n.id === id
          ? { ...n, data: { ...n.data, vaultId: newVaultId } }
          : n,
      ),
    );
  };

  const updateInbox = (addr: string) => {
    clearValidationForDominoId?.(id);
    const cleaned = addr.trim().toLowerCase();
    data.setNodes?.((nodes: any[]) =>
      nodes.map((n: { id: string; data: any }) =>
        n.id === id
          ? { ...n, data: { ...n.data, inboxAddress: cleaned } }
          : n,
      ),
    );
  };

  const updateSender = (addr: string) => {
    clearValidationForDominoId?.(id);
    const cleaned = addr.trim().toLowerCase();
    data.setNodes?.((nodes: any[]) =>
      nodes.map((n: { id: string; data: any }) =>
        n.id === id
          ? { ...n, data: { ...n.data, senderAddress: cleaned } }
          : n,
      ),
    );
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border'
            : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('emailtrigger')}
      >
        <span>Email Trigger</span>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="flex flex-col gap-3 py-2 text-dominofy-light-text dark:text-dominofy-dark-text">
        {/* Connect Gmail */}
        <div className="px-3">
          <button
            type="button"
            className="w-full px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
            onClick={startOAuth}
          >
            {safeConnections.length === 0 ? 'Connect Gmail' : 'Add Gmail connection'}
          </button>
        </div>

        {/* Connection selection */}
        {loadingConns ? (
          <p className="text-sm px-3">Loading Gmail connections…</p>
        ) : safeConnections.length > 0 ? (
          <div className="flex flex-col gap-1 px-3">
            <label className="text-xs font-medium">Gmail Account</label>
            <SearchableSelect
              value={vaultId}
              onChange={updateVaultId}
              placeholder="Select account"
              options={safeConnections.map(c => ({
                label: c.email || c.name,
                value: c.id,
              }))}
            />
          </div>
        ) : (
          <p className="text-sm px-3 text-gray-600">
            Connect Gmail to start listening for emails.
          </p>
        )}

        {/* Inbox filter */}
        {vaultId && (
          <div className="flex flex-col gap-1 px-3">
            <label className="text-xs font-medium">Inbox Address (optional filter)</label>
            <input
              type="text"
              placeholder={selectedConn?.email || 'you@gmail.com'}
              value={inboxAddress}
              onChange={e => updateInbox(e.target.value)}
              className="px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
            <p className="text-[11px] text-gray-500">
              Leave blank to trigger on any email for this Gmail connection.
            </p>
          </div>
        )}

        {vaultId && (
          <div className="flex flex-col gap-1 px-3">
            <label className="text-xs font-medium">Sender Address (optional filter)</label>
            <input
              type="text"
              placeholder="sender@example.com"
              value={senderAddress}
              onChange={e => updateSender(e.target.value)}
              className="px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
            <p className="text-[11px] text-gray-500">
              Leave blank to allow any sender.
            </p>
          </div>
        )}

        <div className="px-3 flex items-center justify-between relative">
          <div></div>
          <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
            Output
          </span>
          <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
        </div>

      </div>
    </div>
  );
}
