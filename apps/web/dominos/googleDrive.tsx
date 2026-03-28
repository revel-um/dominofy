'use client';

import { NodeProps, useEdges } from 'reactflow';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FolderCog, FolderInput, FolderPen, FolderSync, HardDriveUpload, Shield, Tags } from 'lucide-react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { FilesApi } from '../apis/files.apis';
import { useRouter } from 'next/router';
import { FiLoader, FiUpload, FiX } from 'react-icons/fi';
import SearchableSelect from '@/components/searchableDropdown';
import { DriveApi, DriveConnection } from '@/apis/drive.apis';
import dominoCatalog from './dominos';

type FileValue = {
  key: string;
  url: string;
  size: number;
  name: string;
  mime?: string;
};

type GoogleDriveNodeData = DominoNodeData & {
  previewMode?: boolean;
  vaultId?: string;
  connect?: string;
  action?: string;
  bulkAction?: string;
  targets?: string;
  tags?: string;
  destinationPath?: string;
  renameTemplate?: string;
  accessRole?: string;
  accessType?: string;
  accessEmail?: string;
  accessDomain?: string;
  fullPath?: string;
  workflowId?: string;
  setFieldValue?: (heading: string, value: unknown) => void;
};

type GoogleDriveNodeRecord = {
  id: string;
  data: GoogleDriveNodeData;
};

const ACTION_OPTIONS = [
  { label: 'Upload', value: 'upload' },
  { label: 'Bulk action', value: 'bulk' },
];

const BULK_ACTION_OPTIONS = [
  { label: 'Tag files', value: 'tag' },
  { label: 'Move files', value: 'move' },
  { label: 'Rename files', value: 'rename' },
  { label: 'Set access', value: 'access' },
];

const ACCESS_ROLE_OPTIONS = [
  { label: 'Reader', value: 'reader' },
  { label: 'Commenter', value: 'commenter' },
  { label: 'Writer', value: 'writer' },
];

const ACCESS_TYPE_OPTIONS = [
  { label: 'User', value: 'user' },
  { label: 'Group', value: 'group' },
  { label: 'Domain', value: 'domain' },
  { label: 'Anyone', value: 'anyone' },
];

const googleDriveMeta = dominoCatalog.find((entry) => entry.id === 'googleDrive');
const googleDriveAccentColor = googleDriveMeta?.badgeStyle?.background
  ? String(googleDriveMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

function mergeFieldPreservingConnections(newF: DominoField, oldF?: DominoField) {
  if (!oldF) return newF;
  const {
    value,
    shouldRender,
    inPinId,
    type,
    heading,
    options,
    required,
    placeholder,
    needsUpload,
  } = newF;
  return {
    ...oldF,
    type,
    heading,
    options,
    required,
    shouldRender,
    inPinId,
    value,
    placeholder,
    needsUpload,
  };
}

export default function GoogleDriveDomino({ data, id, selected }: NodeProps) {
  const router = useRouter();
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const nodeData = data as GoogleDriveNodeData;
  const isPreviewMode = Boolean(nodeData.previewMode);
  const edges = useEdges();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setNodesRef = useRef(data.setNodes);
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  const findField = (heading: string) =>
    data?.details?.fields?.find((f: DominoField) => f.heading === heading);

  const getInitialText = (heading: string, fallbackKey: string) => {
    const field = findField(heading);
    if (typeof field?.value === 'string') return field.value;
    const fallback = nodeData[fallbackKey];
    return typeof fallback === 'string' ? fallback : '';
  };

  const getInitialFile = () => {
    const field = findField('File Upload');
    const v = field?.value;
    if (v && typeof v === 'object') return v as FileValue;
    return null;
  };

  const initialVaultId = nodeData.vaultId;
  const [connectValue, setConnectValue] = useState(
    initialVaultId || getInitialText('Connect', 'connect')
  );
  const [actionMode, setActionMode] = useState(
    getInitialText('Action', 'action') || 'upload'
  );
  const [bulkAction, setBulkAction] = useState(
    getInitialText('Bulk Action', 'bulkAction') || 'tag'
  );
  const [bulkTargets, setBulkTargets] = useState(
    getInitialText('Targets', 'targets')
  );
  const [bulkTags, setBulkTags] = useState(getInitialText('Tags', 'tags'));
  const [bulkDestination, setBulkDestination] = useState(
    getInitialText('Destination Path', 'destinationPath')
  );
  const [renameTemplate, setRenameTemplate] = useState(
    getInitialText('Rename Template', 'renameTemplate')
  );
  const [accessRole, setAccessRole] = useState(
    getInitialText('Access Role', 'accessRole') || 'reader'
  );
  const [accessType, setAccessType] = useState(
    getInitialText('Access Type', 'accessType') || 'user'
  );
  const [accessEmail, setAccessEmail] = useState(
    getInitialText('Access Email', 'accessEmail')
  );
  const [accessDomain, setAccessDomain] = useState(
    getInitialText('Access Domain', 'accessDomain')
  );
  const [fullPath, setFullPath] = useState(getInitialText('Full Path', 'fullPath'));
  const [fileValue, setFileValue] = useState<FileValue | null>(getInitialFile());
  const [fileName, setFileName] = useState(fileValue?.name ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const [connections, setConnections] = useState<DriveConnection[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const didInitRef = useRef(false);
  const bootstrappedRef = useRef(false);

  const selectedConn = useMemo(
    () => connections.find(c => c.id === connectValue),
    [connections, connectValue],
  );

  const isConnected = useMemo(
    () => (pinId: string) =>
      edges.some((edge) => edge.target === id && edge.targetHandle === pinId),
    [edges, id]
  );

  const connectConnected = isConnected('value_connect');
  const actionConnected = isConnected('value_action');
  const bulkActionConnected = isConnected('value_bulk_action');
  const bulkTargetsConnected = isConnected('value_bulk_targets');
  const bulkTagsConnected = isConnected('value_bulk_tags');
  const bulkDestinationConnected = isConnected('value_bulk_destination');
  const renameTemplateConnected = isConnected('value_bulk_rename_template');
  const accessRoleConnected = isConnected('value_bulk_access_role');
  const accessTypeConnected = isConnected('value_bulk_access_type');
  const accessEmailConnected = isConnected('value_bulk_access_email');
  const accessDomainConnected = isConnected('value_bulk_access_domain');
  const fileConnected = isConnected('value_file');
  const pathConnected = isConnected('value_full_path');

  useEffect(() => {
    if (didInitRef.current) return;
    const connect = initialVaultId || getInitialText('Connect', 'connect');
    const action = getInitialText('Action', 'action');
    const bulkAct = getInitialText('Bulk Action', 'bulkAction');
    const targets = getInitialText('Targets', 'targets');
    const tags = getInitialText('Tags', 'tags');
    const destination = getInitialText('Destination Path', 'destinationPath');
    const template = getInitialText('Rename Template', 'renameTemplate');
    const role = getInitialText('Access Role', 'accessRole');
    const type = getInitialText('Access Type', 'accessType');
    const email = getInitialText('Access Email', 'accessEmail');
    const domain = getInitialText('Access Domain', 'accessDomain');
    const path = getInitialText('Full Path', 'fullPath');
    const file = getInitialFile();
    if (connect) setConnectValue(connect);
    if (action) setActionMode(action);
    if (bulkAct) setBulkAction(bulkAct);
    if (targets) setBulkTargets(targets);
    if (tags) setBulkTags(tags);
    if (destination) setBulkDestination(destination);
    if (template) setRenameTemplate(template);
    if (role) setAccessRole(role);
    if (type) setAccessType(type);
    if (email) setAccessEmail(email);
    if (domain) setAccessDomain(domain);
    if (path) setFullPath(path);
    if (file) {
      setFileValue(file);
      setFileName(file.name ?? '');
    }
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
      } catch (err) {
        console.error('Error fetching Google Drive connections', err);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();
    return () => void (mounted = false);
  }, [isPreviewMode, token, router]);


  useEffect(() => {
    if (!data.setNodes) return;
    if (bootstrappedRef.current) return;
    if (data.setFieldValue && data.details) {
      bootstrappedRef.current = true;
      return;
    }

    const setFieldValue = (heading: string, value: unknown) => {
      const stringValue = typeof value === 'string' ? value : '';
      if (heading === 'Connect') setConnectValue(stringValue);
      if (heading === 'Action') setActionMode(stringValue);
      if (heading === 'Bulk Action') setBulkAction(stringValue);
      if (heading === 'Targets') setBulkTargets(stringValue);
      if (heading === 'Tags') setBulkTags(stringValue);
      if (heading === 'Destination Path') setBulkDestination(stringValue);
      if (heading === 'Rename Template') setRenameTemplate(stringValue);
      if (heading === 'Access Role') setAccessRole(stringValue);
      if (heading === 'Access Type') setAccessType(stringValue);
      if (heading === 'Access Email') setAccessEmail(stringValue);
      if (heading === 'Access Domain') setAccessDomain(stringValue);
      if (heading === 'Full Path') setFullPath(stringValue);
      if (heading === 'File Upload') {
        const file = value && typeof value === 'object' ? (value as FileValue) : null;
        setFileValue(file);
        setFileName(file?.name ?? '');
      }

      data.setNodes?.((nodes: GoogleDriveNodeRecord[]) =>
        nodes.map((n: GoogleDriveNodeRecord) =>
          n.id !== id
            ? n
            : {
                ...n,
                data: {
                  ...n.data,
                  vaultId: heading === 'Connect' ? value : n.data?.vaultId,
                  details: {
                    ...n.data.details,
                    fields: (n.data.details?.fields ?? []).map((f: DominoField) =>
                      f.heading === heading ? { ...f, value } : f
                    ),
                  },
                },
              }
        )
      );
    };

    data.setNodes((prev: GoogleDriveNodeRecord[]) =>
      prev.map((n: GoogleDriveNodeRecord) =>
        n.id !== id
          ? n
          : {
              ...n,
              data: {
                ...n.data,
                setFieldValue,
                exportFields: [
                  'Connect',
                  'Action',
                  'File Upload',
                  'Full Path',
                  'Bulk Action',
                  'Targets',
                  'Tags',
                  'Destination Path',
                  'Rename Template',
                  'Access Role',
                  'Access Type',
                  'Access Email',
                  'Access Domain',
                ],
                details:
                  n.data.details ??
                  ({
                    type: 'Google Drive',
                    description: 'Upload a file or run bulk actions in Google Drive.',
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

    const isBulk = actionMode === 'bulk';
    const isUpload = !isBulk;
    const needsTags = isBulk && bulkAction === 'tag';
    const needsMove = isBulk && bulkAction === 'move';
    const needsRename = isBulk && bulkAction === 'rename';
    const needsAccess = isBulk && bulkAction === 'access';

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
        type: 'dropdown',
        heading: 'Action',
        value: actionConnected ? '' : actionMode,
        inPinId: 'value_action',
        required: true,
        shouldRender: true,
        options: ACTION_OPTIONS,
      },
      {
        type: 'file',
        heading: 'File Upload',
        value: fileConnected ? '' : fileValue ?? '',
        inPinId: 'value_file',
        required: isUpload,
        shouldRender: false,
        needsUpload: isUpload && !fileValue,
      },
      {
        type: 'textInput',
        heading: 'Full Path',
        value: pathConnected ? '' : fullPath,
        inPinId: 'value_full_path',
        required: isUpload,
        shouldRender: true,
        placeholder: pathConnected ? 'Connected' : '/My Drive/folder/file.ext',
      },
      {
        type: 'dropdown',
        heading: 'Bulk Action',
        value: bulkActionConnected ? '' : bulkAction,
        inPinId: 'value_bulk_action',
        required: isBulk,
        shouldRender: isBulk,
        options: BULK_ACTION_OPTIONS,
      },
      {
        type: 'textArea',
        heading: 'Targets',
        value: bulkTargetsConnected ? '' : bulkTargets,
        inPinId: 'value_bulk_targets',
        required: isBulk,
        shouldRender: isBulk,
        placeholder: 'One path or id per line',
      },
      {
        type: 'textInput',
        heading: 'Tags',
        value: bulkTagsConnected ? '' : bulkTags,
        inPinId: 'value_bulk_tags',
        required: needsTags,
        shouldRender: needsTags,
        placeholder: 'tag1, tag2',
      },
      {
        type: 'textInput',
        heading: 'Destination Path',
        value: bulkDestinationConnected ? '' : bulkDestination,
        inPinId: 'value_bulk_destination',
        required: needsMove,
        shouldRender: needsMove,
        placeholder: '/My Drive/folder/',
      },
      {
        type: 'textInput',
        heading: 'Rename Template',
        value: renameTemplateConnected ? '' : renameTemplate,
        inPinId: 'value_bulk_rename_template',
        required: needsRename,
        shouldRender: needsRename,
        placeholder: '{name}-archived',
      },
      {
        type: 'dropdown',
        heading: 'Access Role',
        value: accessRoleConnected ? '' : accessRole,
        inPinId: 'value_bulk_access_role',
        required: needsAccess,
        shouldRender: needsAccess,
        options: ACCESS_ROLE_OPTIONS,
      },
      {
        type: 'dropdown',
        heading: 'Access Type',
        value: accessTypeConnected ? '' : accessType,
        inPinId: 'value_bulk_access_type',
        required: needsAccess,
        shouldRender: needsAccess,
        options: ACCESS_TYPE_OPTIONS,
      },
      {
        type: 'textInput',
        heading: 'Access Email',
        value: accessEmailConnected ? '' : accessEmail,
        inPinId: 'value_bulk_access_email',
        required: needsAccess && accessType !== 'anyone' && accessType !== 'domain',
        shouldRender: needsAccess && accessType !== 'anyone' && accessType !== 'domain',
        placeholder: 'user@example.com',
      },
      {
        type: 'textInput',
        heading: 'Access Domain',
        value: accessDomainConnected ? '' : accessDomain,
        inPinId: 'value_bulk_access_domain',
        required: needsAccess && accessType === 'domain',
        shouldRender: needsAccess && accessType === 'domain',
        placeholder: 'example.com',
      },
    ];

    const nextExport = [
      'Connect',
      'Action',
      'File Upload',
      'Full Path',
      'Bulk Action',
      'Targets',
      'Tags',
      'Destination Path',
      'Rename Template',
      'Access Role',
      'Access Type',
      'Access Email',
      'Access Domain',
    ];

    setNodes((nodes: GoogleDriveNodeRecord[]) => {
      const idx = nodes.findIndex((n: GoogleDriveNodeRecord) => n.id === id);
      if (idx < 0) return nodes;

      const node = nodes[idx];
      const existing = node.data.details?.fields ?? [];
      const existingMap = new Map<string, DominoField>();
      existing.forEach((f: DominoField) => {
        if (f?.heading) existingMap.set(f.heading, f);
      });
      const nextFields = freshFields.map((f) =>
        mergeFieldPreservingConnections(f, existingMap.get(f.heading as string))
      );
      const sameFields =
        existing.length === nextFields.length &&
        existing.every((f: DominoField, i: number) => JSON.stringify(f) === JSON.stringify(nextFields[i]));
      const sameExport =
        Array.isArray(node.data.exportFields) &&
        node.data.exportFields.length === nextExport.length &&
        node.data.exportFields.every((h: string, i: number) => h === nextExport[i]);
      if (sameFields && sameExport) return nodes;

      const nextNode = {
        ...node,
        data: {
          ...node.data,
          vaultId: connectConnected ? node.data?.vaultId : connectValue,
          details: {
            type: 'Google Drive',
            description: 'Upload a file or run bulk actions in Google Drive.',
            fields: nextFields,
          } as DominoNodeData,
          exportFields: nextExport,
        },
      };
      const nextNodes = nodes.slice();
      nextNodes[idx] = nextNode;
      return nextNodes;
    });
  }, [
    connectConnected,
    actionMode,
    actionConnected,
    connectValue,
    bulkAction,
    bulkActionConnected,
    bulkTargets,
    bulkTargetsConnected,
    bulkTags,
    bulkTagsConnected,
    bulkDestination,
    bulkDestinationConnected,
    renameTemplate,
    renameTemplateConnected,
    accessRole,
    accessRoleConnected,
    accessType,
    accessTypeConnected,
    accessEmail,
    accessEmailConnected,
    accessDomain,
    accessDomainConnected,
    fileConnected,
    fileValue,
    fullPath,
    id,
    pathConnected,
  ]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearValidationForDominoId(id);
    setIsUploading(true);

    try {
      setFileName(file.name);

      const token = localStorage.getItem('token') || '';
      const res = await FilesApi.uploadFile(file, token, router, data.workflowId);
      if (!res) {
        toast.error('File upload failed');
        return;
      }

      const { key, location } = res;
      const valueObj: FileValue = {
        key,
        url: location,
        size: file.size,
        name: file.name,
        mime: file.type || undefined,
      };

      setFileValue(valueObj);
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
    data.setNodes?.((nodes: GoogleDriveNodeRecord[]) => {
      const idx = nodes.findIndex((n: GoogleDriveNodeRecord) => n.id === id);
      if (idx < 0) return nodes;
      const node = nodes[idx];
      const nextNode = { ...node, data: { ...node.data, vaultId: newVaultId } };
      const nextNodes = nodes.slice();
      nextNodes[idx] = nextNode;
      return nextNodes;
    });
  };

  const handleRemove = async () => {
    clearValidationForDominoId(id);

    try {
      if (fileValue?.key) {
        const token = localStorage.getItem('token') || '';
        await FilesApi.deleteFile(fileValue.key, token, router);
      }
    } catch {
      toast.error('Failed to delete file');
    }

    setFileValue(null);
    setFileName('');
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
    textarea = false,
  }: {
    pinId: string;
    label: string;
    status: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    textarea?: boolean;
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
          <div className={`flex gap-2 px-4 ${textarea ? 'items-start' : 'items-center'}`}>
            <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline />
            <div
              className={`min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10 ${
                textarea ? 'min-h-24' : 'min-h-12'
              }`}
            >
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

      <div
        className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10"
      >
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={googleDriveAccentColor ? { borderColor: googleDriveAccentColor, backgroundColor: `${googleDriveAccentColor}22` } : undefined}
          >
            {googleDriveMeta?.icon ? (
              <googleDriveMeta.icon
                className="h-4 w-4"
                style={googleDriveAccentColor ? { color: googleDriveAccentColor } : googleDriveMeta.iconStyle}
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">Google Drive</div>
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
                options={connections.map(c => ({
                  label: c.email || c.name,
                  value: c.id,
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
          pinId: 'value_action',
          label: 'Action',
          status: actionConnected ? 'Live input' : 'Static input',
          icon: FolderCog,
          children: actionConnected ? (
            <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
              Connected
            </div>
          ) : (
            <select
              value={actionMode}
              onChange={(e) => {
                setActionMode(e.target.value);
                clearValidationForDominoId(id);
              }}
              className="nodrag h-full min-h-12 w-full rounded-lg bg-dominofy-light-surface px-4 py-3 text-sm text-dominofy-light-text outline-none dark:bg-dominofy-dark-surface dark:text-dominofy-dark-text"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ),
        })}

        {actionMode !== 'bulk' ? (
          <>
            {renderPinnedControl({
              pinId: 'value_file',
              label: 'File',
              status: fileConnected ? 'Live input' : fileName ? 'Ready' : isUploading ? 'Uploading' : 'Choose file',
              icon: HardDriveUpload,
              children: !fileConnected ? (
                fileName ? (
                  <div className="flex min-h-12 items-center gap-2 px-4 py-3">
                    <span className="flex-1 truncate text-sm text-dominofy-light-text dark:text-dominofy-dark-text">
                      {fileName}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isUploading}
                      title="Remove file"
                    >
                      <FiX className="rotate-45 w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-12 items-center gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded
                                 bg-dominofy-light-accent text-white hover:opacity-90 transition
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isUploading}
                      title="Choose file"
                    >
                      {isUploading ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <FiUpload className="w-4 h-4" />
                          <span>Choose File</span>
                        </>
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    {isUploading && (
                      <FiLoader className="h-4 w-4 text-blue-500 animate-spin" />
                    )}
                  </div>
                )
              ) : (
                <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                  Connected
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
                  onChange={(e) => {
                    setFullPath(e.target.value);
                    clearValidationForDominoId(id);
                  }}
                  placeholder={pathConnected ? 'Connected' : '/My Drive/folder/file.ext'}
                  readOnly={pathConnected}
                  disabled={pathConnected}
                  className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit disabled:italic dark:text-dominofy-dark-text"
                />
              ),
            })}
          </>
        ) : (
          <>
            {renderPinnedControl({
              pinId: 'value_bulk_action',
              label: 'Bulk Action',
              status: bulkActionConnected ? 'Live input' : 'Static input',
              icon: FolderCog,
              children: bulkActionConnected ? (
                <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                  Connected
                </div>
              ) : (
                <select
                  value={bulkAction}
                  onChange={(e) => {
                    setBulkAction(e.target.value);
                    clearValidationForDominoId(id);
                  }}
                  className="nodrag h-full min-h-12 w-full rounded-lg bg-dominofy-light-surface px-4 py-3 text-sm text-dominofy-light-text outline-none dark:bg-dominofy-dark-surface dark:text-dominofy-dark-text"
                >
                  {BULK_ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ),
            })}

            {renderPinnedControl({
              pinId: 'value_bulk_targets',
              label: 'Targets',
              status: bulkTargetsConnected ? 'Live input' : 'Static input',
              icon: FolderSync,
              textarea: true,
              children: bulkTargetsConnected ? (
                <div className="flex min-h-24 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                  Connected
                </div>
              ) : (
                <textarea
                  value={bulkTargets}
                  onChange={(e) => {
                    setBulkTargets(e.target.value);
                    clearValidationForDominoId(id);
                  }}
                  placeholder="One path per line. Prefix id: for file ids."
                  rows={3}
                  className="nodrag min-h-24 w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                />
              ),
            })}

            {bulkAction === 'tag' && (
              renderPinnedControl({
                pinId: 'value_bulk_tags',
                label: 'Tags',
                status: bulkTagsConnected ? 'Live input' : 'Static input',
                icon: Tags,
                children: bulkTagsConnected ? (
                  <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                    Connected
                  </div>
                ) : (
                  <input
                    type="text"
                    value={bulkTags}
                    onChange={(e) => {
                      setBulkTags(e.target.value);
                      clearValidationForDominoId(id);
                    }}
                    placeholder="tag1, tag2"
                    className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                ),
              })
            )}

            {bulkAction === 'move' && (
              renderPinnedControl({
                pinId: 'value_bulk_destination',
                label: 'Destination',
                status: bulkDestinationConnected ? 'Live input' : 'Static input',
                icon: FolderInput,
                children: bulkDestinationConnected ? (
                  <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                    Connected
                  </div>
                ) : (
                  <input
                    type="text"
                    value={bulkDestination}
                    onChange={(e) => {
                      setBulkDestination(e.target.value);
                      clearValidationForDominoId(id);
                    }}
                    placeholder="/My Drive/folder/"
                    className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                ),
              })
            )}

            {bulkAction === 'rename' && (
              renderPinnedControl({
                pinId: 'value_bulk_rename_template',
                label: 'Rename Template',
                status: renameTemplateConnected ? 'Live input' : 'Static input',
                icon: FolderPen,
                children: renameTemplateConnected ? (
                  <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                    Connected
                  </div>
                ) : (
                  <input
                    type="text"
                    value={renameTemplate}
                    onChange={(e) => {
                      setRenameTemplate(e.target.value);
                      clearValidationForDominoId(id);
                    }}
                    placeholder="{name}-archived"
                    className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                ),
              })
            )}

            {bulkAction === 'access' && (
              <>
                {renderPinnedControl({
                  pinId: 'value_bulk_access_role',
                  label: 'Access Role',
                  status: accessRoleConnected ? 'Live input' : 'Static input',
                  icon: Shield,
                  children: accessRoleConnected ? (
                    <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                      Connected
                    </div>
                  ) : (
                    <select
                      value={accessRole}
                      onChange={(e) => {
                        setAccessRole(e.target.value);
                        clearValidationForDominoId(id);
                      }}
                      className="nodrag h-full min-h-12 w-full rounded-lg bg-dominofy-light-surface px-4 py-3 text-sm text-dominofy-light-text outline-none dark:bg-dominofy-dark-surface dark:text-dominofy-dark-text"
                    >
                      {ACCESS_ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ),
                })}
                {renderPinnedControl({
                  pinId: 'value_bulk_access_type',
                  label: 'Access Type',
                  status: accessTypeConnected ? 'Live input' : 'Static input',
                  icon: Shield,
                  children: accessTypeConnected ? (
                    <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                      Connected
                    </div>
                  ) : (
                    <select
                      value={accessType}
                      onChange={(e) => {
                        setAccessType(e.target.value);
                        clearValidationForDominoId(id);
                      }}
                      className="nodrag h-full min-h-12 w-full rounded-lg bg-dominofy-light-surface px-4 py-3 text-sm text-dominofy-light-text outline-none dark:bg-dominofy-dark-surface dark:text-dominofy-dark-text"
                    >
                      {ACCESS_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ),
                })}
                {(accessType === 'user' || accessType === 'group') && (
                  renderPinnedControl({
                    pinId: 'value_bulk_access_email',
                    label: 'Access Email',
                    status: accessEmailConnected ? 'Live input' : 'Static input',
                    icon: Shield,
                    children: accessEmailConnected ? (
                      <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                        Connected
                      </div>
                    ) : (
                      <input
                        type="email"
                        value={accessEmail}
                        onChange={(e) => {
                          setAccessEmail(e.target.value);
                          clearValidationForDominoId(id);
                        }}
                        placeholder="user@example.com"
                        className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                      />
                    ),
                  })
                )}
                {accessType === 'domain' && (
                  renderPinnedControl({
                    pinId: 'value_bulk_access_domain',
                    label: 'Access Domain',
                    status: accessDomainConnected ? 'Live input' : 'Static input',
                    icon: Shield,
                    children: accessDomainConnected ? (
                      <div className="flex min-h-12 items-center px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                        Connected
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={accessDomain}
                        onChange={(e) => {
                          setAccessDomain(e.target.value);
                          clearValidationForDominoId(id);
                        }}
                        placeholder="example.com"
                        className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none placeholder:text-inherit dark:text-dominofy-dark-text"
                      />
                    ),
                  })
                )}
              </>
            )}
          </>
        )}

        <div className="relative pt-1">
          <div className="flex items-center justify-end gap-2 px-4">
            <div className="min-w-0 text-right text-sm font-medium text-foreground/65 dark:text-slate-300">
              Output
            </div>
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
          </div>
        </div>
      </div>

    </div>
  );
}
