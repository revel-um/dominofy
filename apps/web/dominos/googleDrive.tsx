'use client';

import { NodeProps, useEdges } from 'reactflow';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
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
  const [fullPath, setFullPath] = useState(getInitialText('Full Path', 'fullPath'));
  const [fileValue, setFileValue] = useState<FileValue | null>(getInitialFile());
  const [fileName, setFileName] = useState(fileValue?.name ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const [connections, setConnections] = useState<DriveConnection[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const didInitRef = useRef(false);

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
  const fileConnected = isConnected('value_file');
  const pathConnected = isConnected('value_full_path');

  useEffect(() => {
    if (didInitRef.current) return;
    const connect = initialVaultId || getInitialText('Connect', 'connect');
    const path = getInitialText('Full Path', 'fullPath');
    const file = getInitialFile();
    if (connect) setConnectValue(connect);
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
    if (data.setFieldValue && data.details) return;

    const setFieldValue = (heading: string, value: any) => {
      if (heading === 'Connect') setConnectValue(value);
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
                exportFields: ['Connect', 'File Upload', 'Full Path'],
                details:
                  n.data.details ??
                  ({
                    type: 'Google Drive',
                    description: 'Upload a file to Google Drive or reference a full path.',
                    fields: [],
                  } as DominoNodeData),
              },
            }
      )
    );
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
        type: 'file',
        heading: 'File Upload',
        value: fileConnected ? '' : fileValue ?? '',
        inPinId: 'value_file',
        required: true,
        shouldRender: false,
        needsUpload: !fileValue,
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

    const nextExport = ['Connect', 'File Upload', 'Full Path'];

    setNodes((nodes: any[]) =>
      nodes.map((n: any) => {
        if (n.id !== id) return n;
        const nodeVaultId = (n.data as any)?.vaultId;
        if (!connectConnected && nodeVaultId && nodeVaultId !== connectValue) {
          setConnectValue(nodeVaultId);
        }
        const existing = n.data.details?.fields ?? [];
        const existingMap = new Map<string, DominoField>();
        existing.forEach((f: DominoField) => {
          if (f?.heading) existingMap.set(f.heading, f);
        });
        const nextFields = freshFields.map((f) =>
          mergeFieldPreservingConnections(f, existingMap.get(f.heading as string))
        );
        const sameFields =
          existing.length === nextFields.length &&
          existing.every((f: any, idx: number) => JSON.stringify(f) === JSON.stringify(nextFields[idx]));
        const sameExport =
          Array.isArray(n.data.exportFields) &&
          n.data.exportFields.length === nextExport.length &&
          n.data.exportFields.every((h: string, i: number) => h === nextExport[i]);
        if (sameFields && sameExport) return n;
        return {
          ...n,
          data: {
            ...n.data,
            vaultId: connectConnected ? n.data?.vaultId : connectValue,
            details: {
              type: 'Google Drive',
              description: 'Upload a file to Google Drive or reference a full path.',
              fields: nextFields,
            } as DominoNodeData,
            exportFields: nextExport,
          },
        };
      })
    );
  }, [
    connectConnected,
    connectValue,
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
    data.setNodes?.((nodes: any[]) =>
      nodes.map((n: any) =>
        n.id === id ? { ...n, data: { ...n.data, vaultId: newVaultId } } : n
      ),
    );
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
        style={{
          backgroundColor: '#3b82f6',
          borderBottomColor: '#2563eb',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
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
                {isUploading && <FiLoader className="h-4 w-4 text-blue-500 animate-spin" />}
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
