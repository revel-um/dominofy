// src/dominos/slackTrigger.tsx
import React, { useEffect, useState } from 'react';
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { useRouter } from 'next/router';
import { SlackApi } from '@/apis/slack.apis';

export default function SlackTriggerDomino({ data, id, selected }: NodeProps) {
  /* ---------------- hooks & helpers ---------------- */
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);

  const router = useRouter();
  const token  = localStorage.getItem('token') || '';

  /* ---------------- extract current values ---------------- */
  const fields = data?.details?.fields || [];
  const connectionId = fields.find((f: { heading: string; }) => f.heading === 'Connection')?.value as string;
  const channel      = fields.find((f: { heading: string; }) => f.heading === 'Channel')?.value    as string;

  /* ---------------- local UI state ---------------- */
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);
  const [channels,    setChannels]    = useState<{ id: string; name: string }[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [loadingCh,    setLoadingCh]    = useState(false);

  /* ---------------- initialise node schema ---------------- */
  useEffect(() => {
    if (!data.setFieldValue && data.setNodes) {
      const setFieldValue = (heading: string, value: any) =>
        data.setNodes((ns: any[]) => ns.map((n: { id: string; data: { details: { fields: DominoField[]; }; }; }) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...n.data.details,
                    fields: n.data.details.fields.map((f: DominoField) =>
                      f.heading === heading ? { ...f, value } : f
                    ),
                  },
                },
              }
            : n,
        ));

      const init: DominoNodeData = {
        type: 'SlackTrigger',
        description: 'Triggers when a new message is posted in the selected Slack channel.',
        fields: [
          { type: 'textInput', heading: 'Connection', placeholder: '', required: true, value: '' },
          { type: 'textInput', heading: 'Channel',    placeholder: '', required: true, value: '' },
        ],
      };

      data.setNodes((prev: any[]) => prev.map((n: { id: string; data: any; }) =>
        n.id === id
          ? { ...n, data: { ...n.data, details: init, exportFields: [], setFieldValue } }
          : n,
      ));
    }
  }, [data, id]);

  /* ---------------- load connections ---------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingConns(true);
      try {
        const resp = await SlackApi.getConnections(token, router);
        if (mounted) setConnections(resp || []);
      } catch (err) {
        console.error('Error fetching Slack connections', err);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();
    return () => { mounted = false; };
  }, [token, router]);

  /* ---------------- load channels when connection changes ---------------- */
  useEffect(() => {
    if (!connectionId) return;
    let mounted = true;
    (async () => {
      setLoadingCh(true);
      try {
        const resp = await SlackApi.getChannels(token, router, connectionId);
        if (mounted) setChannels(resp || []);
      } catch (err) {
        console.error('Error fetching channels', err);
      } finally {
        if (mounted) setLoadingCh(false);
      }
    })();
    return () => { mounted = false; };
  }, [connectionId, token, router]);

  /* ---------------- handlers ---------------- */
  const startOAuth = async () => {
    const url = await SlackApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const setFieldValue = (heading: string) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    data.setFieldValue?.(heading, e.target.value);

  /* ---------------- render ---------------- */
  return (
    <div className={`rounded-md w-64 p-2 shadow ${selected ? 'selected-border' : 'unselected-border'}`}>
      <div className="flex items-center justify-between p-2 bg-blue-600 text-white rounded-t">
        <span>Slack Channel Trigger</span>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="p-2 space-y-3">
        {loadingConns ? (
          <p>Loading Slack connections…</p>
        ) : connections.length === 0 ? (
          <button className="btn" onClick={startOAuth}>Connect to Slack</button>
        ) : (
          <div>
            <label>Slack Connection:</label>
            <select value={connectionId || ''} onChange={setFieldValue('Connection')}>
              <option value="">Select connection</option>
              {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {connectionId && (
          <div>
            <label>Channel to Watch:</label>
            {loadingCh ? (
              <p>Loading channels…</p>
            ) : (
              <select value={channel || ''} onChange={setFieldValue('Channel')}>
                <option value="">Select channel</option>
                {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
              </select>
            )}
          </div>
        )}

        {hasError && <p className="text-red-500 text-sm">Please configure both connection and channel.</p>}
      </div>
    </div>
  );
}