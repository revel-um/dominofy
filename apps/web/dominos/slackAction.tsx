import React, { useCallback, useEffect, useState } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { useRouter, NextRouter } from 'next/router';
import { SlackApi, SlackConnection } from '@/apis/slack.apis';
import SearchableSelect from '@/components/searchableDropdown';

interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
  isPrivate: boolean;
}

export default function SlackActionDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);

  const router: NextRouter = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const { getEdges } = useReactFlow();

  // Helpers to read values from details.fields
  const getField = (heading: string) =>
    (data.details as DominoNodeData | undefined)?.fields?.find(f => f.heading === heading);
  const vaultId: string = getField('vaultId')?.value ?? '';
  const channelId: string = getField('channelId')?.value ?? '';
  const textValue: string = getField('text')?.value ?? '';

  const [connections, setConnections] = useState<SlackConnection[]>([]);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [loadingCh, setLoadingCh] = useState(false);

  // Initialize node details + exportFields once
  useEffect(() => {
    if (!data.setNodes) return;
    data.setNodes((prev: any[]) => {
      let changed = false;
      const next = prev.map(node => {
        if (node.id !== id) return node;
        const newData: any = { ...node.data };
        const details: DominoNodeData | undefined = newData.details as DominoNodeData | undefined;
        if (!details?.fields) {
          newData.details = {
            type: 'SlackAction',
            description: 'Sends a message to a Slack channel.',
            isTrigger: false,
            fields: [
              { type: 'dropdown', heading: 'vaultId', value: '', options: [], required: true, shouldRender: false },
              { type: 'dropdown', heading: 'channelId', value: '', options: [], required: true, shouldRender: false },
              { type: 'textInput', heading: 'text', value: '', inPinId: 'value_in', required: true, shouldRender: false },
            ],
          } as DominoNodeData;
          newData.exportFields = ['vaultId', 'channelId', 'text'];
          changed = true;
        } else if (!newData.exportFields) {
          newData.exportFields = ['vaultId', 'channelId', 'text'];
          changed = true;
        }
        return changed ? { ...node, data: newData } : node;
      });
      return changed ? next : prev;
    });
  }, [data.setNodes, id]);

  // Helper to update a field value inside details.fields
  const setFieldValue = useCallback(
    (heading: string, val: string) => {
      if (!data.setNodes) return;
      data.setNodes((nodes: any[]) =>
        nodes.map((n: { id: string; data: any }) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...(n.data.details as DominoNodeData),
                    fields: (n.data.details as DominoNodeData).fields.map(f =>
                      f.heading === heading ? { ...f, value: val } : f,
                    ),
                  },
                },
              }
            : n,
        ),
      );
    },
    [data.setNodes, id],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingConns(true);
      try {
        const list = await SlackApi.getConnections(token, router);
        if (mounted) setConnections(list ?? []);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();
    return () => void (mounted = false);
  }, [token, router]);

  useEffect(() => {
    if (!vaultId) return;
    let mounted = true;
    (async () => {
      setLoadingCh(true);
      try {
        const list = await SlackApi.getChannels(token, router, vaultId);
        if (mounted) setChannels(list ?? []);
      } finally {
        if (mounted) setLoadingCh(false);
      }
    })();
    return () => void (mounted = false);
  }, [vaultId, token, router]);

  const startOAuth = async () => {
    const url = await SlackApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const updateVaultId = (newVaultId: string) => {
    setFieldValue('vaultId', newVaultId);
  };

  const updateChannelId = (chId: string) => {
    setFieldValue('channelId', chId);
  };

  const updateText = (val: string) => {
    setFieldValue('text', val);
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#4a154b',
          borderBottomColor: '#3a0f3b',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Slack Action</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="flex flex-col gap-3 py-2 text-dominofy-light-text dark:text-dominofy-dark-text">
        {/* Connect */}
        {loadingConns ? (
          <p className="text-sm px-3">Loading Slack connections…</p>
        ) : (
          <div className="px-3">
            <button
              type="button"
              className="w-full px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
              onClick={startOAuth}
            >
              {connections.length === 0 ? 'Connect to Slack' : 'Add connection'}
            </button>
          </div>
        )}

        {/* Select connection */}
        {connections.length > 0 && (
          <div className="flex flex-col gap-1 px-3">
            <label className="text-xs font-medium">Slack Connection</label>
            <SearchableSelect
              value={vaultId}
              onChange={updateVaultId}
              placeholder="Select connection"
              options={connections.map(c => ({ label: c.name, value: c.id }))}
            />
          </div>
        )}

        {/* Channel */}
        {vaultId && (
          <div className="flex flex-col gap-1 px-3">
            <label className="text-xs font-medium">Channel</label>
            {loadingCh ? (
              <p className="text-sm">Loading channels…</p>
            ) : (
              <SearchableSelect
                value={channelId}
                onChange={updateChannelId}
                placeholder="Select channel"
                options={channels.map(ch => ({ label: ch.name, value: ch.id }))}
              />
            )}
          </div>
        )}

        {/* Message */}
        <div className="flex items-center gap-2 relative px-3">
          <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
          {getEdges().some(e => e.target === id && e.targetHandle === 'value_in') ? (
            <div className="flex-1 px-2 py-1 italic text-gray-500">Connected</div>
          ) : (
            <input
              type="text"
              placeholder="Hello from Dominofy!"
              value={textValue}
              onChange={(e) => updateText(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          )}
        </div>

        <div className="px-3 flex items-center justify-between relative">
          <div></div>
          <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Output</span>
          <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
        </div>
      </div>
    </div>
  );
}


