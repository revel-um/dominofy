'use client';

import { NodeProps, useEdges } from 'reactflow';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FolderInput, FolderSync } from 'lucide-react';
import { useRouter } from 'next/router';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import SearchableSelect from '@/components/searchableDropdown';
import { DriveApi, DriveConnection } from '@/apis/drive.apis';
import dominoCatalog from './dominos';

type GoogleDriveDownloadNodeData = DominoNodeData & {
  previewMode?: boolean;
  vaultId?: string;
  connect?: string;
  fullPath?: string;
  setFieldValue?: (heading: string, value: unknown) => void;
};

type GoogleDriveDownloadNodeRecord = {
  id: string;
  data: GoogleDriveDownloadNodeData;
};

const googleDriveDownloadMeta = dominoCatalog.find(
  (entry) => entry.id === 'googleDriveDownload'
);
const googleDriveDownloadAccentColor = googleDriveDownloadMeta?.badgeStyle?.background
  ? String(googleDriveDownloadMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

function mergeFieldPreservingConnections(newField: DominoField, oldField?: DominoField) {
  if (!oldField) return newField;
  const { value, shouldRender, inPinId, type, heading, options, required, placeholder } = newField;
  return {
    ...oldField,
    type,
    heading,
    options,
    required,
    shouldRender,
    inPinId,
    value,
    placeholder,
  };
}

export default function GoogleDriveDownloadDomino({ data, id, selected }: NodeProps) {
  const router = useRouter();
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const nodeData = data as GoogleDriveDownloadNodeData;
  const isPreviewMode = Boolean(nodeData.previewMode);
  const edges = useEdges();
  const setNodesRef = useRef(data.setNodes);
  const didInitRef = useRef(false);
  const bootstrappedRef = useRef(false);
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const findField = (heading: string) =>
    data?.details?.fields?.find((field: DominoField) => field.heading === heading);

  const getInitialText = (heading: string, fallbackKey: string) => {
    const field = findField(heading);
    if (typeof field?.value === 'string') return field.value;
    const fallback = nodeData[fallbackKey];
    return typeof fallback === 'string' ? fallback : '';
  };

  const [connectValue, setConnectValue] = useState(
    nodeData.vaultId || getInitialText('Connect', 'connect')
  );
  const [fullPath, setFullPath] = useState(getInitialText('Full Path', 'fullPath'));
  const [connections, setConnections] = useState<DriveConnection[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);

  const selectedConn = useMemo(
    () => connections.find((connection) => connection.id === connectValue),
    [connections, connectValue]
  );

  const isConnected = useMemo(
    () => (pinId: string) =>
      edges.some((edge) => edge.target === id && edge.targetHandle === pinId),
    [edges, id]
  );

  const connectConnected = isConnected('value_connect');
  const pathConnected = isConnected('value_full_path');

  useEffect(() => {
    if (didInitRef.current) return;
    const connect = nodeData.vaultId || getInitialText('Connect', 'connect');
    const path = getInitialText('Full Path', 'fullPath');
    if (connect) setConnectValue(connect);
    if (path) setFullPath(path);
    didInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.details?.fields]);

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
        const list = await DriveApi.getConnections(token, router);
        if (mounted) setConnections(list ?? []);
      } catch (error) {
        console.error('Error fetching Google Drive connections', error);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isPreviewMode, token, router]);

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;
    if (data.setFieldValue && data.details) {
      bootstrappedRef.current = true;
      return;
    }

    const setFieldValue = (heading: string, value: unknown) => {
      const stringValue = typeof value === 'string' ? value : '';
      if (heading === 'Connect') setConnectValue(stringValue);
      if (heading === 'Full Path') setFullPath(stringValue);

      data.setNodes?.((nodes: GoogleDriveDownloadNodeRecord[]) =>
        nodes.map((node: GoogleDriveDownloadNodeRecord) =>
          node.id !== id
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  vaultId: heading === 'Connect' ? stringValue : node.data.vaultId,
                  details: {
                    ...node.data.details,
                    fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                      field.heading === heading ? { ...field, value } : field
                    ),
                  },
                },
              }
        )
      );
    };

    data.setNodes((prev: GoogleDriveDownloadNodeRecord[]) =>
      prev.map((node: GoogleDriveDownloadNodeRecord) =>
        node.id !== id
          ? node
          : {
              ...node,
              data: {
                ...node.data,
                setFieldValue,
                exportFields: ['Connect', 'Full Path'],
                details:
                  node.data.details ??
                  ({
                    type: 'Google Drive Download',
                    description: 'Download a file from Google Drive to the workflow.',
                    fields: [],
                  } as DominoNodeData),
              },
            }
      )
    );

    bootstrappedRef.current = true;
  }, [data, id]);

  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const freshFields: DominoField[] = [
      {
        type: 'textInput',
        heading: 'Connect',
        value: connectConnected ? '' : connectValue,
        inPinId: 'value_connect',
        required: true,
        shouldRender: true,
        placeholder: connectConnected ? 'Connected' : 'Connection name',
      },
      {
        type: 'textInput',
        heading: 'Full Path',
        value: pathConnected ? '' : fullPath,
        inPinId: 'value_full_path',
        required: true,
        shouldRender: true,
        placeholder: pathConnected ? 'Connected' : '/My Drive/folder/file.ext',
      },
    ];

    const nextExport = ['Connect', 'Full Path'];

    setNodes((nodes: GoogleDriveDownloadNodeRecord[]) =>
      nodes.map((node: GoogleDriveDownloadNodeRecord) => {
        if (node.id !== id) return node;
        const existing = node.data.details?.fields ?? [];
        const existingMap = new Map<string, DominoField>();
        existing.forEach((field: DominoField) => {
          if (field.heading) existingMap.set(field.heading, field);
        });
        const nextFields = freshFields.map((field) =>
          mergeFieldPreservingConnections(field, existingMap.get(field.heading as string))
        );
        const sameFields =
          existing.length === nextFields.length &&
          existing.every(
            (field: DominoField, index: number) =>
              JSON.stringify(field) === JSON.stringify(nextFields[index])
          );
        const sameExport =
          Array.isArray(node.data.exportFields) &&
          node.data.exportFields.length === nextExport.length &&
          node.data.exportFields.every((heading: string, index: number) => heading === nextExport[index]);
        if (sameFields && sameExport) return node;
        return {
          ...node,
          data: {
            ...node.data,
            vaultId: connectConnected ? node.data.vaultId : connectValue,
            details: {
              type: 'Google Drive Download',
              description: 'Download a file from Google Drive to the workflow.',
              fields: nextFields,
            } as DominoNodeData,
            exportFields: nextExport,
          },
        };
      })
    );
  }, [connectConnected, connectValue, fullPath, id, pathConnected]);

  const startOAuth = async () => {
    const url = await DriveApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const updateVaultId = (newVaultId: string) => {
    clearValidationForDominoId(id);
    setConnectValue(newVaultId);
    if (data.setFieldValue) {
      data.setFieldValue('Connect', newVaultId);
      return;
    }
    data.setNodes?.((nodes: GoogleDriveDownloadNodeRecord[]) =>
      nodes.map((node: GoogleDriveDownloadNodeRecord) =>
        node.id === id ? { ...node, data: { ...node.data, vaultId: newVaultId } } : node
      )
    );
  };

  const renderSectionLabel = (icon: React.ComponentType<{ className?: string }>, label: string) => {
    const Icon = icon;
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
        <Icon className="h-3 w-3" />
        {label}
      </div>
    );
  };

  const renderPinnedControl = ({
    pinId,
    label,
    status,
    icon,
    children,
  }: {
    pinId: string;
    label: string;
    status: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-4">
        {renderSectionLabel(icon, label)}
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
          {status}
        </span>
      </div>

      <div className="pb-3">
        <div className="relative">
          <div className="flex items-center gap-2 px-4">
            <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline />
            <div className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
      } hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={googleDriveDownloadAccentColor ? { borderColor: googleDriveDownloadAccentColor, backgroundColor: `${googleDriveDownloadAccentColor}22` } : undefined}
          >
            {googleDriveDownloadMeta?.icon ? (
              <googleDriveDownloadMeta.icon
                className="h-4 w-4"
                style={googleDriveDownloadAccentColor ? { color: googleDriveDownloadAccentColor } : googleDriveDownloadMeta.iconStyle}
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Google Drive Download
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Action
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 pb-4 pt-4">
        <div className="space-y-4 px-4">
          <div className="flex items-center justify-between gap-2">
            {renderSectionLabel(FolderSync, 'Account')}
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Google Drive
            </span>
          </div>

          <button
            type="button"
            className="w-full rounded-lg border border-transparent bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            onClick={startOAuth}
          >
            {connections.length === 0 ? 'Connect Google Drive' : 'Add Drive connection'}
          </button>

          {loadingConns ? (
            <div className="rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              Loading Google Drive connections…
            </div>
          ) : connections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              Connect Google Drive to select an account.
            </div>
          ) : null}
        </div>

        {renderPinnedControl({
          pinId: 'value_connect',
          label: 'Connection',
          status: connectConnected ? 'Live input' : 'Static input',
          icon: FolderSync,
          children: connectConnected ? (
            <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
              Connected
            </div>
          ) : loadingConns ? (
            <div className="flex min-h-12 items-center px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              Loading Google Drive connections…
            </div>
          ) : connections.length > 0 ? (
            <div className="rounded-lg px-1 py-1">
              <SearchableSelect
                value={connectValue}
                onChange={updateVaultId}
                placeholder={selectedConn?.email || 'Select account'}
                options={connections.map((connection) => ({
                  label: connection.email || connection.name,
                  value: connection.id,
                }))}
              />
            </div>
          ) : (
            <div className="flex min-h-12 items-center px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              No connections available
            </div>
          ),
        })}

        {renderPinnedControl({
          pinId: 'value_full_path',
          label: 'Path',
          status: pathConnected ? 'Live input' : 'Static input',
          icon: FolderInput,
          children: (
            <input
              type="text"
              value={pathConnected ? '' : fullPath}
              onChange={(event) => {
                setFullPath(event.target.value);
                clearValidationForDominoId(id);
              }}
              placeholder={pathConnected ? 'Connected' : '/My Drive/folder/file.ext'}
              readOnly={pathConnected}
              disabled={pathConnected}
              className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit disabled:italic dark:text-dominofy-dark-text"
            />
          ),
        })}

        <div className="relative px-4 pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Downloaded file payload
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
