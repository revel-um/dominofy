import { NodeProps } from 'reactflow';
import { useEffect, useRef, useState } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { FiUpload, FiX } from 'react-icons/fi';
import { useDomino } from '../contexts/dominoContext';

export default function ReadFileDomino({ data, id, selected }: NodeProps) {
    const { erroredNodes } = useDomino();
    const hasError = erroredNodes.includes(id);
    const isValueConnected = data?.valueConnected ?? false;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const getInitialFileName = () => {
        const field = data?.details?.fields?.find((f: any) => f.heading === 'File Name');
        return typeof field?.value === 'string' ? field.value : '';
    };

    const [fileName, setFileName] = useState(getInitialFileName());

    // 🔄 Sync fileName from details.fields on load or import
    useEffect(() => {
        const field = data?.details?.fields?.find((f: any) => f.heading === 'File Name');
        if (field && field.value !== fileName) {
            setFileName(field.value);
        }
    }, [data?.details?.fields]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        if (data.setNodes) {
            data.setNodes((nodes: any[]) =>
                nodes.map((node: any) =>
                    node.id === id
                        ? {
                            ...node,
                            data: {
                                ...node.data,
                                details: {
                                    ...node.data.details,
                                    fields: [
                                        { heading: 'File Name', value: file.name, type: 'text', inPinId: 'value_in' },
                                    ],
                                },
                            },
                        }
                        : node
                )
            );
        }
    };

    // 🧠 One-time setup if no details exist
    useEffect(() => {
        if (!data.details && data.setNodes) {
            data.setNodes((prevNodes: any[]) =>
                prevNodes.map((node: any) =>
                    node.id === id
                        ? {
                            ...node,
                            data: {
                                ...node.data,
                                details: {
                                    type: 'Read File',
                                    description: 'Reads a file from input or manual upload',
                                    fields: [{inPinId: 'value_in'}],
                                },
                                exportFields: ['File Name'],
                            },
                        }
                        : node
                )
            );
        }
    }, [data, id]);

    return (
        <div
            className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
        ${hasError ? 'border-red-500 border-4' : selected ? 'selected-border border-4' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
        >
            <div
                className="relative px-3 py-2 text-sm font-semibold text-white border-b flex justify-between items-center"
                style={{ backgroundColor: '#0ea5e9', borderBottomColor: '#0284c7' }}
            >
                Read File
            </div>

            {hasError && (
                <p className="mt-1 text-xs px-3 py-2 text-red-500">
                    ⚠️ Value input pin is connected but execution pin is missing.
                </p>
            )}
            {!isValueConnected && (
                <div className="px-4 py-4 flex flex-col gap-2 items-center">
                    {fileName ? (
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex-1 truncate text-sm text-dominofy-light-text dark:text-dominofy-dark-text">
                                {fileName}
                            </div>
                            <button
                                title="Remove File"
                                onClick={() => {
                                    setFileName('');
                                    if (data.setNodes) {
                                        data.setNodes((nodes: any[]) =>
                                            nodes.map((node: any) =>
                                                node.id === id
                                                    ? {
                                                        ...node,
                                                        data: {
                                                            ...node.data,
                                                            details: {
                                                                ...node.data.details,
                                                                fields: [],
                                                            },
                                                        },
                                                    }
                                                    : node
                                            )
                                        );
                                    }
                                }}
                                className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
                            >
                                <FiX className="rotate-45 w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                title="Choose File"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded bg-dominofy-light-accent text-white hover:opacity-90 transition"
                            >
                                <FiUpload className="w-4 h-4" />
                                <span>Choose File</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                            />
                        </>
                    )}
                </div>
            )}

            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} />
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} />
            <DominoPin id="value_in" pinType={PinType.VALUE_IN} />
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} />
        </div>
    );
}
