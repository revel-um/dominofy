'use client';

 import { NodeProps, useEdges } from 'reactflow';
 import React, { useEffect, useMemo, useRef, useState } from 'react';
 import { toast } from 'react-toastify';
 import DominoPin from '../components/shared/dominoPin';
 import { PinType } from '../types/pinTypes';
 import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
 import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
 import { useRouter } from 'next/router';
 import { FiAlertCircle } from 'react-icons/fi';
 import SearchableSelect from '@/components/searchableDropdown';
 import { DriveApi, DriveConnection } from '@/apis/drive.apis';

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
   };
 }

 export default function GoogleDriveDownloadDomino({ data, id, selected }: NodeProps) {
   const router = useRouter();
   const { erroredNodes, clearValidationForDominoId } = useDomino();
   const hasError = erroredNodes.includes(id);
   const isPreviewMode = Boolean((data as any).previewMode);
   const edges = useEdges();
   const setNodesRef = useRef(data.setNodes);
   const didInitRef = useRef(false);
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

   const initialVaultId = (data as any)?.vaultId as string | undefined;
   const [connectValue, setConnectValue] = useState(
     initialVaultId || getInitialText('Connect', 'connect')
   );
   const [fullPath, setFullPath] = useState(getInitialText('Full Path', 'fullPath'));
   const [connections, setConnections] = useState<DriveConnection[]>([]);
   const [loadingConns, setLoadingConns] = useState(true);

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
   const pathConnected = isConnected('value_full_path');

   useEffect(() => {
     if (didInitRef.current) return;
     const connect = initialVaultId || getInitialText('Connect', 'connect');
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
     if (data.setFieldValue && data.details) return;

     const setFieldValue = (heading: string, value: any) => {
       if (heading === 'Connect') setConnectValue(value);
       if (heading === 'Full Path') setFullPath(value);

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
                 exportFields: ['Connect', 'Full Path'],
                 details:
                   n.data.details ??
                   ({
                     type: 'Google Drive Download',
                     description: 'Download a file from Google Drive to the workflow.',
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

     setNodes((nodes: any[]) =>
       nodes.map((n: any) => {
         if (n.id !== id) return n;
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
     data.setNodes?.((nodes: any[]) =>
       nodes.map((n: any) =>
         n.id === id ? { ...n, data: { ...n.data, vaultId: newVaultId } } : n
       ),
     );
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
         style={getExpandedDominoHeaderStyle('googleDriveDownload')}
       >
         <div className="flex items-center gap-1">
           <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
           <span className="truncate">Google Drive Download</span>
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
