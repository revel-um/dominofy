// src/dominos/readExcel.tsx
import { NodeProps } from 'reactflow';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { FiLoader, FiUpload, FiX, FiAlertCircle } from 'react-icons/fi';
import { useDomino } from '../contexts/dominoContext';
import { DominoNodeData } from '../types/dominoFieldTypes';
import { FilesApi } from '../apis/files.apis';
import { useRouter } from 'next/router';

export default function ReadExcelDomino({ data, id, selected }: NodeProps) {
  const router = useRouter();
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isValueConnected = data?.valueConnected ?? false;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const getInitialFile = () =>
    (data.details?.fields?.find(
      (f: { heading: string }) => f.heading === 'File'
    )?.value as string) || '';
  const [fileName, setFileName] = useState(getInitialFile);
  const [isUploading, setIsUploading] = useState(false);

  /* keep local fileName in sync if workflow imported */
  useEffect(() => {
    const f = data.details?.fields?.find((x: { heading: string }) => x.heading === 'File');
    if (f && f.value !== fileName) setFileName(f.value as string);
  }, [data.details?.fields]);

  /* ───────── upload handler */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Please upload a valid Excel or CSV file (.xlsx / .xls / .csv)');
      return;
    }    

    clearValidationForDominoId(id);
    setIsUploading(true);

    try {
      setFileName(file.name);
      await new Promise(r => setTimeout(r, 2000)); // UI delay
      const token = localStorage.getItem('token') || '';
      const res = await FilesApi.uploadFile(file, token, router);
      if (!res) return toast.error('File upload failed');

      const { key, location } = res;
      const size = file.size; // file size in bytes

      data.setNodes?.((nodes: any[]) =>
        nodes.map((n: any) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    type: 'Read Excel',
                    description: 'Reads data from an Excel file',
                    fields: [
                      {
                        inPinId: 'value_in',
                        type: 'file',
                        heading: 'File',
                        value: file.name,
                        file: { key, url: location, size },
                        required: true,
                        shouldRender: false,
                        needsUpload: false,
                        exportOverride: 'file',
                      },
                    ],
                  } as DominoNodeData,
                  exportFields: ['File'],
                },
              }
            : n
        )
      );
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  /* ───────── remove handler */
  const handleRemove = async () => {
    clearValidationForDominoId(id);
    const key = (data.details?.fields?.find(
      (f: { heading: string }) => f.heading === 'File'
    ) as any)?.file?.key;
    try {
      if (key) {
        const token = localStorage.getItem('token') || '';
        await FilesApi.deleteFile(key, token, router);
      }
    } catch {
      toast.error('Failed to delete file');
    }
    setFileName('');
    data.setNodes?.((nodes: any[]) =>
      nodes.map((n: any) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                details: {
                  type: 'Read Excel',
                  description: 'Reads data from an Excel file',
                  fields: [
                    {
                      inPinId: 'value_in',
                      type: 'file',
                      heading: 'File',
                      value: '',
                      required: true,
                      shouldRender: false,
                      needsUpload: true,
                      exportOverride: 'file',
                    },
                  ],
                } as DominoNodeData,
              },
            }
          : n
      )
    );
  };

  /* one-time bootstrap */
  useEffect(() => {
    if (!data.details && data.setNodes) {
      data.setNodes((prev: any[]) =>
        prev.map((n: any) =>
          n.id !== id
            ? n
            : {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    type: 'Read Excel',
                    description: 'Reads data from an Excel file',
                    fields: [
                      {
                        inPinId: 'value_in',
                        type: 'file',
                        heading: 'File',
                        value: '',
                        required: true,
                        shouldRender: false,
                        needsUpload: true,
                        exportOverride: 'file',
                      },
                    ],
                  } as DominoNodeData,
                  exportFields: ['File'],
                },
              }
        )
      );
    }
  }, [data.details, data.setNodes, id]);

  /* ───────── render */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header with exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#0ea5e9',
          borderBottomColor: '#0284c7',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Read Excel</span>
          {isUploading && (
            <FiLoader className="ml-2 h-5 w-5 text-white animate-spin" />
          )}
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Value-in + upload / connected indicator row */}
      <div className="py-2">
        <div className="flex items-center gap-2 relative">
          {/* Always-visible input pin */}
          <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />

          {/* Swap upload UI vs. connected indicator */}  
          {!isValueConnected ? (
            fileName ? (
              <div className="flex-1 flex items-center gap-2 px-3 py-2">
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
              <div className="flex-1 flex items-center justify-center gap-2 px-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded
                             bg-dominofy-light-accent text-white hover:opacity-90 transition
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUploading}
                  title="Choose Excel file"
                >
                  {isUploading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading…</span>
                    </>
                  ) : (
                    <>
                      <FiUpload className="w-4 h-4" />
                      <span>Choose Excel File</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )
          ) : (
            <span className="px-3 flex-1 text-xs italic text-gray-500 truncate">
              dynamic value
            </span>
          )}

          {/* Always-visible output pin */}
          <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
        </div>

        {hasError && (
          <p className="mt-2 px-3 text-xs text-red-500 flex items-center gap-1">
            <FiAlertCircle />
            Value pin connected but execution pin missing.
          </p>
        )}
      </div>
    </div>
  );
}
