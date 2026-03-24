// import { NodeProps } from 'reactflow';
// import DominoPin from '../components/shared/dominoPin';
// import { PinType } from '../types/pinTypes';
// import { ChangeEvent, useEffect, useState } from 'react';
// import { useDomino } from '../contexts/dominoContext';
// import { Trash } from 'lucide-react';

// export default function SwitchDomino({ data, id, selected }: NodeProps) {
//   const { erroredNodes } = useDomino();
//   const hasError = erroredNodes.includes(id);

//   const [value, setValue] = useState<string>('');
//   const [inputs, setInputs] = useState<string[]>(['']);

//   const addInput = () => setInputs(prev => [...prev, '']);
//   const removeInput = (index: number) => setInputs(prev => prev.filter((_, i) => i !== index));
//   const handleInputChange = (index: number, newVal: string) => {
//     setInputs(prev => {
//       const arr = [...prev];
//       arr[index] = newVal;
//       return arr;
//     });
//   };

//   // ✅ Initialize ONCE on mount from details.fields:
//   useEffect(() => {
//     const field = data?.details?.fields?.find((f: { heading: string; }) => f?.heading === 'Text');
//     if (field?.value) setValue(field.value);

//     const caseFields = data?.details?.fields?.filter((f: { heading: string; }) => f?.heading?.startsWith('Case_')) || [];
//     if (caseFields.length > 0) {
//       setInputs(caseFields.map((f: { value: any; }) => f?.value ?? ''));
//     } else {
//       setInputs(['']);
//     }
//   }, []); // empty deps → run ONCE

//   // ✅ Keep backend fields in sync with local state
//   useEffect(() => {
//     if (!data.setNodes) return;
//     data.setNodes((nodes: any[]) =>
//       nodes.map((node: { id: string; data: { details: any; }; }) =>
//         node.id !== id
//           ? node
//           : {
//               ...node,
//               data: {
//                 ...node.data,
//                 details: {
//                   ...node.data.details,
//                   fields: [
//                     { type: 'switch', value, required: true, heading: 'Text', shouldRender: false },
//                     ...inputs.map((inp, idx) => ({
//                       type: 'switch',
//                       value: inp,
//                       required: true,
//                       heading: `Case_${idx + 1}`,
//                       shouldRender: false,
//                     })),
//                   ],
//                 },
//               },
//             }
//       )
//     );
//   }, [inputs, value, data.setNodes, id]);

//   const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
//     const newValue = e.target.value;
//     setValue(newValue);
//     data.setFieldValue?.('Text', newValue);
//   };

//   return (
//     <div
//       className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
//         ${hasError ? 'border-red-500 border-4' : selected ? 'selected-border border-4' : 'unselected-border'}
//         bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
//     >
//       <div
//         className="relative px-3 py-2 text-sm font-semibold text-white border-b"
//         style={{
//           backgroundColor: '#6366f1',
//           borderBottomColor: '#4f46e5',
//           display: 'flex',
//           justifyContent: 'space-between',
//         }}
//       >
//         Switch
//       </div>

//       <div className="px-3 py-2">
//         <label className="block mb-1 text-sm font-medium">Input</label>
//         <input
//           type="text"
//           value={value}
//           onChange={handleChange}
//           placeholder="Text"
//           className="w-full px-2 py-1 mb-2 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
//         />
//         <DominoPin id="value_in" pinType={PinType.VALUE_IN} pinPosition="60px" />
//       </div>

//       <div className="px-3 py-2">
//         {inputs.map((inp, index) => (
//           <div key={index} className="flex items-center gap-2 mb-2">
//             <input
//               type="text"
//               value={inp}
//               onChange={e => handleInputChange(index, e.target.value)}
//               placeholder={`Case ${index + 1}`}
//               name={`Case${index + 1}`}
//               className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
//             />
//             <DominoPin
//               id={`exec_out_${index + 1}`}
//               pinType={PinType.EXEC_OUT}
//               pinPosition={`${index * 40 + 105}px`}
//             />
//             <DominoPin
//               id={`value_in_${index + 1}`}
//               pinType={PinType.VALUE_IN}
//               pinPosition={`${index * 40 + 105}px`}
//             />
//             {inputs.length > 1 && (
//               <button
//                 onClick={() => removeInput(index)}
//                 className="p-1 rounded hover:bg-gray-200"
//               >
//                 <Trash />
//               </button>
//             )}
//           </div>
//         ))}
//       </div>

//       <div className="px-3 py-2">
//         <button
//           onClick={addInput}
//           className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
//         >
//           Add Input
//         </button>
//       </div>

//       <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition="20px" />

//       {hasError && (
//         <p className="mt-1 text-xs text-red-500">
//           ⚠️ Value input pin is connected but execution pin is missing.
//         </p>
//       )}
//     </div>
//   );
// }





// ______________________________________________________________________________________________________________________


// import React, { useState } from 'react';
// import { FiX, FiPlay, FiCode, FiTerminal, FiLink } from 'react-icons/fi';
// import CodeEditor from '@/components/code-editor/CodeEditor';

// interface SqlRunnerPopupProps {
//   open: boolean;
//   query: string;
//   output: string;
//   connectionStatus: 'disconnected' | 'connecting' | 'connected';
//   onQueryChange: (q: string) => void;
//   onRun: () => void;
//   onConnect: () => void;
//   onDisconnect: () => void;
//   onClose: () => void;
//   style?: React.CSSProperties;
// }

// export default function SqlRunnerPopup({
//   open,
//   query,
//   output,
//   connectionStatus,
//   onQueryChange,
//   onRun,
//   onConnect,
//   onDisconnect,
//   onClose,
//   style = {},
// }: SqlRunnerPopupProps) {
//   const [activeTab, setActiveTab] = useState<'code' | 'output'>('code');
//   if (!open) return null;

//   return (
//     <div
//       className="absolute z-50 flex flex-col w-80 h-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
//       style={style}
//     >
//       {/* Header with tabs and close */}
//       <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
//         <div className="flex space-x-2">
//           <button
//             onClick={() => setActiveTab('code')}
//             className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors focus:outline-none
//               ${activeTab === 'code'
//                 ? 'bg-white dark:bg-gray-800 text-blue-600'
//                 : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}`}
//           >
//             <FiCode />
//             <span>Code</span>
//           </button>
//           <button
//             onClick={() => setActiveTab('output')}
//             className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-md transition-colors focus:outline-none
//               ${activeTab === 'output'
//                 ? 'bg-white dark:bg-gray-800 text-blue-600'
//                 : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}`}
//           >
//             <FiTerminal />
//             <span>Output</span>
//           </button>
//         </div>
//         <button
//           onClick={onClose}
//           className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full focus:outline-none"
//           title="Close"
//         >
//           <FiX className="w-5 h-5 text-gray-600 dark:text-gray-300" />
//         </button>
//       </div>

//       {/* Body: CodeEditor or Output */}
//       <div className="flex-1 overflow-auto bg-white dark:bg-gray-800">
//         {activeTab === 'code' ? (
//           <CodeEditor
//             language="sql"
//             value={query}
//             onChange={val => onQueryChange(val || '')}
//             theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
//             height="100%"
//             options={{
//               minimap: { enabled: false },
//               fontSize: 13,
//               wordWrap: 'on',
//               automaticLayout: true,
//               scrollBeyondLastLine: false,
//               padding: { top: 12, bottom: 12 },
//             }}
//           />
//         ) : (
//           <pre className="p-3 font-mono text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
//             {output || <span className="text-gray-400">No output yet</span>}
//           </pre>
//         )}
//       </div>

//       {/* Footer with Connect/Disconnect and Run */}
//       <div className="flex justify-end items-center px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 space-x-2">
//         {connectionStatus === 'connected' ? (
//           <button
//             onClick={onDisconnect}
//             className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md focus:outline-none"
//           >
//             <span>Disconnect</span>
//           </button>
//         ) : (
//           <button
//             onClick={onConnect}
//             disabled={connectionStatus === 'connecting'}
//             className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md focus:outline-none"
//           >
//             <FiLink />
//             <span>{connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}</span>
//           </button>
//         )}
//         <button
//           onClick={onRun}
//           className="flex items-center space-x-1 px-4 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md focus:outline-none shadow"
//         >
//           <FiPlay />
//           <span>Run</span>
//         </button>
//       </div>
//     </div>
//   );
// }



// 'use client';

// import React, { useState, useEffect } from 'react';
// import { NodeProps } from 'reactflow';
// import SqlRunnerPopup from '../components/modals/SqlRunnerPopup';
// import DominoPin from '../components/shared/dominoPin';
// import { PinType } from '../types/pinTypes';
// import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
// import { useDomino } from '../contexts/dominoContext';
// import { 
//   FiPlay, FiCode, FiDatabase, FiTerminal, FiServer, 
//   FiUser, FiKey, FiLink, FiRefreshCw, FiSun, FiMoon, FiSettings,
//   FiChevronDown, FiChevronUp, FiX, FiCheck, FiSave
// } from 'react-icons/fi';

// interface ConnectionConfig {
//   host: string;
//   port: number;
//   database: string;
//   user: string;
//   password: string;
//   ssl: boolean;
// }

// export default function SQLRunnerDomino({ data, id, selected }: NodeProps) {
//   const { erroredNodes } = useDomino();
//   const hasError = erroredNodes.includes(id);

//   // Query & connection state
//   const [query, setQuery] = useState(
//     (data.details?.fields.find((f: any) => f.heading === 'Query')?.value as string) || ''
//   );
//   const [connected, setConnected] = useState(
//     Boolean(data.details?.fields.find((f: any) => f.heading === 'Connection Name'))
//   );

//   // Popup state & output
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [output, setOutput] = useState('');

//   // Connection config
//   const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>({
//     host: 'localhost',
//     port: 5432,
//     database: 'postgres',
//     user: 'postgres',
//     password: '',
//     ssl: false,
//   });
//   const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
//   const [isConnecting, setIsConnecting] = useState(false);
//   const [showConnectionForm, setShowConnectionForm] = useState<boolean>(false);
//   const [connectionError, setConnectionError] = useState<string>('');


//   // Sync node fields
//   useEffect(() => {
//     if (!data.setNodes) return;
//     data.setNodes((nodes: any[]) =>
//       nodes.map((n: { id: string; data: any; }) => {
//         if (n.id !== id) return n;
//         const fields: DominoField[] = [
//           { type: 'textArea', heading: 'Query', value: query, required: true, placeholder: 'SELECT …', shouldRender: true },
//           { type: 'button', label: 'Connect', onClick: () => setConnected(true), value: '', required: true, shouldRender: true },
//         ];
//         if (connected) {
//           fields.push({ type: 'text', heading: 'Connection Name', value: connectionConfig.database, required: true, shouldRender: true });
//         }
//         return {
//           ...n,
//           data: {
//             ...n.data,
//             details: { type: 'SQLRunner', description: 'Run a SQL query against an existing database connection', fields } as DominoNodeData,
//             exportFields: ['Query'],
//           },
//         };
//       })
//     );
//   }, [data.setNodes, id, query, connected, connectionConfig.database]);

//   // Allow details-panel to update Query
//   useEffect(() => {
//     if (data.setFieldValue || !data.setNodes) return;
//     const setFieldValue = (heading: string, newValue: any) => {
//       if (heading === 'Query') setQuery(newValue);
//       data.setNodes!((nodes: any[]) =>
//         nodes.map((n: { id: string; data: { details: { fields: DominoField[]; }; }; }) =>
//           n.id !== id
//             ? n
//             : {
//                 ...n,
//                 data: {
//                   ...n.data,
//                   details: {
//                     ...n.data.details,
//                     fields: n.data.details.fields.map((f: DominoField) =>
//                       f.heading === heading ? { ...f, value: newValue } : f
//                     ),
//                   },
//                 },
//               }
//         )
//       );
//     };
//     data.setNodes((nodes: any[]) =>
//       nodes.map((n: { id: string; data: any; }) =>
//         n.id === id ? { ...n, data: { ...n.data, setFieldValue } } : n
//       )
//     );
//   }, [data.setFieldValue, data.setNodes, id]);

//   // Test DB connection
//   const handleConnect = async () => {
//     setIsConnecting(true);
//     setConnectionStatus('connecting');
//     try {
//       const res = await fetch('/api/sql/execute?action=test-connection', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ connectionConfig }),
//       });
//       const json = await res.json();
//       if (!res.ok || !json.data?.connected) throw new Error(json.error || 'Connection failed');
//       setConnectionStatus('connected');
//       setConnected(true);
//       setIsPopupOpen(true);
//     } catch (err) {
//       setConnectionStatus('disconnected');
//       console.error(err);
//     } finally {
//       setIsConnecting(false);
//     }
//   };

//   // Disconnect DB
//   const handleDisconnect = () => {
//     setConnectionStatus('disconnected');
//     setConnected(false);
//     setOutput('');
//   };

//   // Run SQL
//   const runQuery = async () => {
//     setOutput('Running…');
//     try {
//       const res = await fetch('/api/sql/execute?action=execute', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ query, connectionConfig }),
//       });
//       const json = await res.json();
//       if (!res.ok) throw new Error(json.error || 'Execution failed');

//       if (json.data?.rows) {
//         const rows = json.data.rows as any[];
//         if (rows.length === 0) {
//           setOutput('No rows returned.');
//         } else {
//           const cols = Object.keys(rows[0]);
//           const header = cols.join(' | ');
//           const lines = rows.map(r => cols.map(c => String(r[c] ?? 'NULL')).join(' | '));
//           setOutput([header, '-'.repeat(header.length), ...lines].join('\n'));
//         }
//       } else {
//         setOutput(JSON.stringify(json.data, null, 2));
//       }
//     } catch (err) {
//       setOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
//     }
//   };

//   return (
//     <>
//       {/* Node box */}
//       <div
//         style={{ minWidth: '14rem' }}
//         className={`transition-all duration-150 rounded-md shadow-sm w-56
//           ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
//           bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
//       >
//         <div
//           className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md"
//           style={{ backgroundColor: '#10b981', borderBottomColor: '#059669' }}
//         >
//           <div className="flex items-center gap-1">
//             <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
//             <span className="truncate">SQL Runner</span>
//           </div>
//           <div className="flex items-center gap-1">
//             <DominoPin id="exec_out_1" pinType={PinType.EXEC_OUT} inline />
//             <DominoPin id="exec_out_2" pinType={PinType.EXEC_OUT} inline />
//           </div>
//         </div>

//         <div className="px-3 py-2">
//           <label className="block text-xs mb-1">Query</label>
//           <input
//             type="text"
//             value={query}
//             readOnly
//             onClick={() => setIsPopupOpen(true)}
//             placeholder="SELECT * FROM …"
//             className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text cursor-pointer"
//           />
//         </div>

//         <div className="flex justify-center py-2">
//           <DominoPin id="value_out_1" pinType={PinType.VALUE_OUT} inline />
//         </div>

//         {hasError && (
//           <p className="mt-1 text-xs text-red-500 px-3">⚠️ Query failed or connection missing.</p>
//         )}
//       </div>

//       {/* Popup */}
//       <SqlRunnerPopup
//         open={isPopupOpen}
//         query={query}
//         output={output}
//         connectionStatus={connectionStatus}
//         onQueryChange={setQuery}
//         onRun={runQuery}
//         onConnect={handleConnect}
//         onDisconnect={handleDisconnect}
//         onClose={() => setIsPopupOpen(false)}
//         style={{ top: 120, left: 200 }}
//       />

//       {/* Connection Form Modal */}
//       {showConnectionForm && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
//             <div className="p-6">
//               <h2 className="text-lg font-medium text-gray-900 mb-4">Connect to Database</h2>

//               <form onSubmit={handleConnect}>
//                 <div className="space-y-4">
//                   <div>
//                     <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-1">
//                       Host
//                     </label>
//                     <div className="relative rounded-md shadow-sm">
//                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                         <FiServer className="h-5 w-5 text-gray-400" />
//                       </div>
//                       <input
//                         type="text"
//                         id="host"
//                         className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
//                         placeholder="localhost"
//                         value={connectionConfig.host}
//                         onChange={(e) => setConnectionConfig({ ...connectionConfig, host: e.target.value })}
//                         required
//                       />
//                     </div>
//                   </div>

//                   <div className="grid grid-cols-2 gap-4">
//                     <div>
//                       <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
//                         Port
//                       </label>
//                       <input
//                         type="number"
//                         id="port"
//                         className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
//                         placeholder="5432"
//                         value={connectionConfig.port}
//                         onChange={(e) => setConnectionConfig({ ...connectionConfig, port: parseInt(e.target.value) || 5432 })}
//                         required
//                       />
//                     </div>
//                     <div>
//                       <label htmlFor="database" className="block text-sm font-medium text-gray-700 mb-1">
//                         Database
//                       </label>
//                       <div className="relative rounded-md shadow-sm">
//                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                           <FiDatabase className="h-5 w-5 text-gray-400" />
//                         </div>
//                         <input
//                           type="text"
//                           id="database"
//                           className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
//                           placeholder="postgres"
//                           value={connectionConfig.database}
//                           onChange={(e) => setConnectionConfig({ ...connectionConfig, database: e.target.value })}
//                           required
//                         />
//                       </div>
//                     </div>
//                   </div>

//                   <div>
//                     <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
//                       Username
//                     </label>
//                     <div className="relative rounded-md shadow-sm">
//                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                         <FiUser className="h-5 w-5 text-gray-400" />
//                       </div>
//                       <input
//                         type="text"
//                         id="username"
//                         className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
//                         placeholder="postgres"
//                         value={connectionConfig.user}
//                         onChange={(e) => setConnectionConfig({ ...connectionConfig, user: e.target.value })}
//                         required
//                       />
//                     </div>
//                   </div>

//                   <div>
//                     <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
//                       Password
//                     </label>
//                     <div className="relative rounded-md shadow-sm">
//                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                         <FiKey className="h-5 w-5 text-gray-400" />
//                       </div>
//                       <input
//                         type="password"
//                         id="password"
//                         className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
//                         placeholder="********"
//                         value={connectionConfig.password}
//                         onChange={(e) => setConnectionConfig({ ...connectionConfig, password: e.target.value })}
//                       />
//                     </div>
//                   </div>

//                   <div className="flex items-center">
//                     <input
//                       id="ssl"
//                       type="checkbox"
//                       className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
//                       checked={connectionConfig.ssl || false}
//                       onChange={(e) => setConnectionConfig({ ...connectionConfig, ssl: e.target.checked })}
//                     />
//                     <label htmlFor="ssl" className="ml-2 block text-sm text-gray-700">
//                       Use SSL
//                     </label>
//                   </div>

//                   {connectionError && (
//                     <div className="text-red-600 text-sm">
//                       {connectionError}
//                     </div>
//                   )}
//                 </div>

//                 <div className="mt-6 flex justify-end space-x-3">
//                   <button
//                     type="button"
//                     onClick={() => setShowConnectionForm(false)}
//                     className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     type="submit"
//                     disabled={isConnecting}
//                     className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {isConnecting ? 'Connecting...' : 'Connect'}
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }


