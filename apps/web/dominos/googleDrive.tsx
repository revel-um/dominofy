'use client';

import { NodeProps, useEdges } from 'reactflow';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
import { FilesApi } from '../apis/files.apis';
import { useRouter } from 'next/router';
import { FiAlertCircle, FiLoader, FiUpload, FiX } from 'react-icons/fi';
import SearchableSelect from '@/components/searchableDropdown';
import { DriveApi, DriveConnection } from '@/apis/drive.apis';

type FileValue = {
  key: string;
  url: string;
  size: number;
  name: string;
  mime?: string;
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

function mergeFieldPreservingConnections(newF: any, oldF?: any) {
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
    const fallback = (data as any)?.[fallbackKey];
    return typeof fallback === 'string' ? fallback : '';
  };

  const getInitialFile = () => {
    const field = findField('File Upload');
    const v = field?.value as any;
    if (v && typeof v === 'object') return v as FileValue;
    return null;
  };

  const initialVaultId = (data as any)?.vaultId as string | undefined;
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
  }, [token, router]);


  useEffect(() => {
    if (!data.setNodes) return;
    if (bootstrappedRef.current) return;
    if (data.setFieldValue && data.details) {
      bootstrappedRef.current = true;
      return;
    }

    const setFieldValue = (heading: string, value: any) => {
      if (heading === 'Connect') setConnectValue(value);
      if (heading === 'Action') setActionMode(value);
      if (heading === 'Bulk Action') setBulkAction(value);
      if (heading === 'Targets') setBulkTargets(value);
      if (heading === 'Tags') setBulkTags(value);
      if (heading === 'Destination Path') setBulkDestination(value);
      if (heading === 'Rename Template') setRenameTemplate(value);
      if (heading === 'Access Role') setAccessRole(value);
      if (heading === 'Access Type') setAccessType(value);
      if (heading === 'Access Email') setAccessEmail(value);
      if (heading === 'Access Domain') setAccessDomain(value);
      if (heading === 'Full Path') setFullPath(value);
      if (heading === 'File Upload') {
        setFileValue(value);
        setFileName(value?.name ?? '');
      }

      data.setNodes?.((nodes: any[]) =>
        nodes.map((n: any) =>
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

    data.setNodes((prev: any[]) =>
      prev.map((n: any) =>
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

    setNodes((nodes: any[]) => {
      const idx = nodes.findIndex((n: any) => n.id === id);
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
        existing.every((f: any, i: number) => JSON.stringify(f) === JSON.stringify(nextFields[i]));
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
    data.setNodes?.((nodes: any[]) => {
      const idx = nodes.findIndex((n: any) => n.id === id);
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

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('googleDrive')}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Google Drive</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />

        {hasError && (
          <FiAlertCircle
            className="absolute right-2 top-2 w-4 h-4 text-red-300"
            title="Missing required input"
          />
        )}
      </div>

      <div className="flex flex-col gap-2 py-2">
        <div className="px-3">
          <button
            type="button"
            className="w-full px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
            onClick={startOAuth}
          >
            {connections.length === 0 ? 'Connect Google Drive' : 'Add Drive connection'}
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 relative">
          {/* <DominoPin id="value_connect" pinType={PinType.VALUE_IN} inline /> */}
          <div className="flex-1">
            <div className="text-xs font-medium mb-1 text-dominofy-light-text dark:text-dominofy-dark-text">
              Google Drive Account
            </div>
            {connectConnected ? (
              <div className="px-2 py-1 text-sm italic text-gray-500">Connected</div>
            ) : loadingConns ? (
              <div className="px-2 py-1 text-sm text-gray-500">
                Loading Google Drive connections...
              </div>
            ) : connections.length > 0 ? (
              <SearchableSelect
                value={connectValue}
                onChange={updateVaultId}
                placeholder={selectedConn?.email || 'Select account'}
                options={connections.map(c => ({
                  label: c.email || c.name,
                  value: c.id,
                }))}
              />
            ) : (
              <div className="px-2 py-1 text-xs text-gray-500">
                Connect Google Drive to select an account.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 relative px-3">
          <DominoPin id="value_action" pinType={PinType.VALUE_IN} inline />
          {actionConnected ? (
            <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
          ) : (
            <select
              value={actionMode}
              onChange={(e) => {
                setActionMode(e.target.value);
                clearValidationForDominoId(id);
              }}
              className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {actionMode !== 'bulk' ? (
          <>
            <div className="flex items-center gap-2 relative px-3">
              <DominoPin id="value_file" pinType={PinType.VALUE_IN} inline />
              {!fileConnected ? (
                fileName ? (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="flex-1 truncate text-sm text-dominofy-light-text dark:text-dominofy-dark-text">
                      {fileName}
                    </span>
                    <button
                      onClick={handleRemove}
                      className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isUploading}
                      title="Remove file"
                    >
                      <FiX className="rotate-45 w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <button
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
                <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
              )}
            </div>

            <div className="flex items-center gap-2 relative px-3">
              <DominoPin id="value_full_path" pinType={PinType.VALUE_IN} inline />
              <input
                type="text"
                value={fullPath}
                onChange={(e) => {
                  setFullPath(e.target.value);
                  clearValidationForDominoId(id);
                }}
                placeholder={pathConnected ? 'Connected' : '/My Drive/folder/file.ext'}
                readOnly={pathConnected}
                disabled={pathConnected}
                className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 relative px-3">
              <DominoPin id="value_bulk_action" pinType={PinType.VALUE_IN} inline />
              {bulkActionConnected ? (
                <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
              ) : (
                <select
                  value={bulkAction}
                  onChange={(e) => {
                    setBulkAction(e.target.value);
                    clearValidationForDominoId(id);
                  }}
                  className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                >
                  {BULK_ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-start gap-2 relative px-3">
              <DominoPin id="value_bulk_targets" pinType={PinType.VALUE_IN} inline />
              {bulkTargetsConnected ? (
                <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
              ) : (
                <textarea
                  value={bulkTargets}
                  onChange={(e) => {
                    setBulkTargets(e.target.value);
                    clearValidationForDominoId(id);
                  }}
                  placeholder="One path per line. Prefix id: for file ids."
                  rows={3}
                  className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                />
              )}
            </div>

            {bulkAction === 'tag' && (
              <div className="flex items-center gap-2 relative px-3">
                <DominoPin id="value_bulk_tags" pinType={PinType.VALUE_IN} inline />
                {bulkTagsConnected ? (
                  <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
                ) : (
                  <input
                    type="text"
                    value={bulkTags}
                    onChange={(e) => {
                      setBulkTags(e.target.value);
                      clearValidationForDominoId(id);
                    }}
                    placeholder="tag1, tag2"
                    className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                  />
                )}
              </div>
            )}

            {bulkAction === 'move' && (
              <div className="flex items-center gap-2 relative px-3">
                <DominoPin id="value_bulk_destination" pinType={PinType.VALUE_IN} inline />
                {bulkDestinationConnected ? (
                  <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
                ) : (
                  <input
                    type="text"
                    value={bulkDestination}
                    onChange={(e) => {
                      setBulkDestination(e.target.value);
                      clearValidationForDominoId(id);
                    }}
                    placeholder="/My Drive/folder/"
                    className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                  />
                )}
              </div>
            )}

            {bulkAction === 'rename' && (
              <div className="flex items-center gap-2 relative px-3">
                <DominoPin id="value_bulk_rename_template" pinType={PinType.VALUE_IN} inline />
                {renameTemplateConnected ? (
                  <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
                ) : (
                  <input
                    type="text"
                    value={renameTemplate}
                    onChange={(e) => {
                      setRenameTemplate(e.target.value);
                      clearValidationForDominoId(id);
                    }}
                    placeholder="{name}-archived"
                    className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                  />
                )}
              </div>
            )}

            {bulkAction === 'access' && (
              <>
                <div className="flex items-center gap-2 relative px-3">
                  <DominoPin id="value_bulk_access_role" pinType={PinType.VALUE_IN} inline />
                  {accessRoleConnected ? (
                    <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
                  ) : (
                    <select
                      value={accessRole}
                      onChange={(e) => {
                        setAccessRole(e.target.value);
                        clearValidationForDominoId(id);
                      }}
                      className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                    >
                      {ACCESS_ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-2 relative px-3">
                  <DominoPin id="value_bulk_access_type" pinType={PinType.VALUE_IN} inline />
                  {accessTypeConnected ? (
                    <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
                  ) : (
                    <select
                      value={accessType}
                      onChange={(e) => {
                        setAccessType(e.target.value);
                        clearValidationForDominoId(id);
                      }}
                      className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                    >
                      {ACCESS_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {(accessType === 'user' || accessType === 'group') && (
                  <div className="flex items-center gap-2 relative px-3">
                    <DominoPin id="value_bulk_access_email" pinType={PinType.VALUE_IN} inline />
                    {accessEmailConnected ? (
                      <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
                    ) : (
                      <input
                        type="email"
                        value={accessEmail}
                        onChange={(e) => {
                          setAccessEmail(e.target.value);
                          clearValidationForDominoId(id);
                        }}
                        placeholder="user@example.com"
                        className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                      />
                    )}
                  </div>
                )}
                {accessType === 'domain' && (
                  <div className="flex items-center gap-2 relative px-3">
                    <DominoPin id="value_bulk_access_domain" pinType={PinType.VALUE_IN} inline />
                    {accessDomainConnected ? (
                      <span className="px-2 flex-1 text-xs italic text-gray-500 truncate">Connected</span>
                    ) : (
                      <input
                        type="text"
                        value={accessDomain}
                        onChange={(e) => {
                          setAccessDomain(e.target.value);
                          clearValidationForDominoId(id);
                        }}
                        placeholder="example.com"
                        className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="px-3 py-1 flex items-center justify-between relative">
          <div />
          <span className="text-xs text-gray-500">Output</span>
          <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
        </div>
      </div>

      {hasError && (
        <p className="mt-1 text-xs text-red-500 px-3 pb-2">
          Missing required fields or a value pin is connected without exec_in.
        </p>
      )}
    </div>
  );
}
