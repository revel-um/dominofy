// src/dominos/slackTrigger.tsx

import React, { useEffect, useState } from 'react';
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { useRouter, NextRouter } from 'next/router';
import { SlackApi, SlackConnection } from '@/apis/slack.apis';
import SearchableSelect from '@/components/searchableDropdown';

/* ——————————————————— Extra data stored on the node ——————————————————— */
interface SlackTriggerData extends DominoNodeData {
  slackTeamId?: string;
  vaultId?: string;
  slackChannelId?: string;
}

/* ——————————————————— Channel shape returned by backend ——————————————————— */
interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
  isPrivate: boolean;
}

/* ——————————————————— Component ——————————————————— */
export default function SlackTriggerDomino({
  data,
  id,
  selected,
}: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);

  const router: NextRouter = useRouter();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  /* ——————————————————— derive stored values ——————————————————— */
  const vaultId: string =
    (data as SlackTriggerData).vaultId || (data as any).connectionId || '';

  const slackChannelId: string =
    (data as SlackTriggerData).slackChannelId || (data as any).channel || '';

  /* ——————————————————— component state ——————————————————— */
  const [connections, setConnections] = useState<SlackConnection[]>([]);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedCh, setSelectedCh] = useState<SlackChannel | null>(null);
  const [loadingConns, setLoadingConns] = useState(true);
  const [loadingCh, setLoadingCh] = useState(false);
  const [inviting, setInviting] = useState(false);

  /* ——————————————————— initialise node schema (first mount only) ——————————————————— */
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
        nodes.map((n: { id: string; data: any; }) =>
          n.id === id
            ? {
              ...n,
              data: {
                ...n.data,
                details: init,
                exportFields: [],
                vaultId: '',
                slackChannelId: '',
              },
            }
            : n
        )
      );
    }
  }, [data, id]);

  /* ——————————————————— load Slack connections ——————————————————— */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingConns(true);
      try {
        const list = await SlackApi.getConnections(token, router);
        if (mounted) setConnections(list ?? []);
      } catch (err) {
        console.error('Error fetching Slack connections', err);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();
    return () => void (mounted = false);
  }, [token, router]);

  /* ——————————————————— load channels whenever vaultId changes ——————————————————— */
  useEffect(() => {
    if (!vaultId) return;
    let mounted = true;
    (async () => {
      setLoadingCh(true);
      try {
        const list = await SlackApi.getChannels(token, router, vaultId);

        if (mounted) {
          setChannels(list ?? []);
          const selectedChannel = (list ?? []).find(c => c.id === slackChannelId) || null
          setSelectedCh(
            selectedChannel
          );
        }
      } catch (err) {
        console.error('Error fetching Slack channels', err);
      } finally {
        if (mounted) setLoadingCh(false);
      }
    })();
    return () => void (mounted = false);
  }, [vaultId, token, router]);

  /* ——————————————————— helpers ——————————————————— */
  const startOAuth = async () => {
    const url = await SlackApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const updateVaultId = (newVaultId: string) => {
    // Find the full connection object from the state
    const selectedConnection = connections.find(c => c.id === newVaultId);

    data.setNodes((nodes: any[]) =>
      nodes.map((n: { id: string; data: SlackTriggerData; }) =>
        n.id === id
          ? {
            ...n,
            data: {
              ...n.data,
              vaultId: newVaultId,
              // Add the slackTeamId from the selected connection
              slackTeamId: selectedConnection?.slackTeamId || '',
            } as SlackTriggerData,
          }
          : n
      )
    );
  };

  const updateChannelId = (chId: string) => {
    const ch = channels.find(c => c.id === chId) || null;
    setSelectedCh(ch);
    data.setNodes((nodes: any[]) =>
      nodes.map((n: { id: string; data: SlackTriggerData; }) =>
        n.id === id
          ? {
            ...n,
            data: { ...n.data, slackChannelId: chId } as SlackTriggerData,
          }
          : n
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
        setSelectedCh(
          (list ?? []).find(c => c.id === selectedCh.id) || null
        );
      }
    } catch (err) {
      console.error('Invite bot error', err);
    } finally {
      setInviting(false);
    }
  };

  /* ——————————————————— render ——————————————————— */
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
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#4f46e5',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <span>Slack Trigger</span>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* body */}
      <div className="flex flex-col gap-3 py-2 text-dominofy-light-text dark:text-dominofy-dark-text">
        {/* 1. Connection */}
        {loadingConns ? (
          <p className="text-sm">Loading Slack connections…</p>
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

        {/* 2. Selection */}

        {loadingConns ? (
          <p className="text-sm">Loading Slack connections…</p>
        ) : connections.length === 0 ? (
          <div>
          </div>
        ) : (
          <div
            className={`flex flex-col gap-1 ${connections.length > 0 ? 'px-3' : ''}`}
          >
            <label className="text-xs font-medium">Slack Connection</label>
            <SearchableSelect
              value={vaultId}
              onChange={updateVaultId}
              placeholder="Select connection"
              options={connections.map(c => ({ label: c.name, value: c.id }))}
            />
          </div>
        )}

        {/* 3. Channel selection */}
        {vaultId && connections.length > 0 && (
          <div className="flex flex-col gap-1 px-3 py-2">
            <label className="text-xs font-medium">Channel to Watch</label>
            {loadingCh ? (
              <p className="text-sm">Loading channels…</p>
            ) : (
              <>
                <SearchableSelect
                  value={slackChannelId}
                  onChange={updateChannelId}
                  placeholder="Select channel"
                  options={channels.map(ch => ({ label: ch.name, value: ch.id }))}
                />

                {selectedCh && !selectedCh.isMember && (
                  selectedCh.isPrivate ? (
                    <p className="text-xs text-orange-600 mt-1">
                      Private channel – ask a member to
                      <code className="ml-1">/invite &lt;bot&gt;</code>
                    </p>
                  ) : (
                    <button
                      onClick={inviteBot}
                      disabled={inviting}
                      className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition mt-1"
                    >
                      {inviting ? 'Inviting…' : 'Invite bot to channel'}
                    </button>
                  )
                )}
              </>
            )}
          </div>
        )}

        <div className="px-3 flex items-center justify-between relative">
          <div></div>
          <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
            Output
          </span>
          <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
        </div>

        {/* error banner */}
        {hasError && (
          <p className="px-3 pb-2 text-xs text-red-500">
            ⚠️ Please configure both connection and channel.
          </p>
        )}
      </div>
    </div>
  );
}
