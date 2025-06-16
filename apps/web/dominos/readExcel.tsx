import { NodeProps } from 'reactflow';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { FiLoader, FiUpload, FiX } from 'react-icons/fi';
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
    const [fileName, setFileName] = useState<string>(() => {
        const field = data?.details?.fields?.find((f: any) => f.heading === 'File');
        return typeof field?.value === 'string' ? field.value : '';
    });
    const [isUploading, setIsUploading] = useState<boolean>(false);

    // Sync fileName from details.fields on load or import
    useEffect(() => {
        const field = data?.details?.fields?.find((f: any) => f.heading === 'File');
        if (field && field.value !== fileName) setFileName(field.value);
    }, [data?.details?.fields]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            toast.error('Please upload a valid Excel file (.xlsx or .xls)');
            return;
        }

        clearValidationForDominoId(id);
        setIsUploading(true);

        try {
            setFileName(file.name);
            // simulate delay for UI
            await new Promise((r) => setTimeout(r, 2000));
            const token = localStorage.getItem('token') || '';
            const response = await FilesApi.uploadFile(file, token, router);
            if (!response) {
                toast.error('File upload failed');
                return;
            }
            const { key, location } = response;

            if (data.setNodes) {
                data.setNodes((nodes: any[]) =>
                    nodes.map((node: any) => {
                        if (node.id !== id) return node;
                        const details: DominoNodeData = {
                            type: 'Read Excel',
                            description: 'Reads data from an Excel (.xlsx or .xls) file',
                            fields: [
                                {
                                    inPinId: 'value_in',
                                    type: 'file',
                                    heading: 'File',
                                    value: file.name,
                                    shouldRender: false,
                                    required: true,
                                    needsUpload: false,
                                    file: { key, url: location },
                                    exportOverride: 'file'
                                }
                            ]
                        };
                        return { ...node, data: { ...node.data, details, exportFields: ['File'] } };
                    })
                );
            }
        } catch (err) {
            console.error('Upload failed', err);
            toast.error('An error occurred during upload');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = async () => {
        clearValidationForDominoId(id);
        const fileField = data?.details?.fields?.find((f: any) => f.heading === 'File');
        const key = (fileField as any)?.file?.key;

        if (key) {
            try {
                const token = localStorage.getItem('token') || '';
                await FilesApi.deleteFile(key, token, router);
            } catch (err) {
                console.error('Delete failed', err);
                toast.error('Failed to delete file');
            }
        }

        setFileName('');
        if (data.setNodes) {
            data.setNodes((nodes: any[]) =>
                nodes.map((node: any) => {
                    if (node.id !== id) return node;
                    const details: DominoNodeData = {
                        type: 'Read Excel',
                        description: 'Reads data from an Excel (.xlsx or .xls) file',
                        fields: [
                            { inPinId: 'value_in', type: 'file', heading: 'File', value: '', shouldRender: false, required: true, needsUpload: true, exportOverride: 'file' }
                        ]
                    };
                    return { ...node, data: { ...node.data, details } };
                })
            );
        }
    };

    // One-time setup if no details exist
    useEffect(() => {
        if (!data.details && data.setNodes) {
            data.setNodes((prevNodes: any[]) =>
                prevNodes.map((node: any) => {
                    if (node.id !== id) return node;
                    const details: DominoNodeData = {
                        type: 'Read Excel',
                        description: 'Reads data from an Excel (.xlsx or .xls) file',
                        fields: [
                            { inPinId: 'value_in', type: 'file', heading: 'File', value: '', shouldRender: false, required: true, needsUpload: true, exportOverride: 'file' }
                        ]
                    };
                    return { ...node, data: { ...node.data, details, exportFields: ['File'] } };
                })
            );
        }
    }, [data, id]);

    return (
        <div
            className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
            ${hasError ? 'error-border' : selected ? 'selected-border border-4' : 'unselected-border dark:border-gray-600'}
            bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
        >
            <div
                className="relative px-3 py-2 text-sm font-semibold text-white flex items-center justify-between border-b"
                style={{ backgroundColor: '#0ea5e9', borderBottomColor: '#0284c7' }}
            >
                <div className="flex items-center">
                    <span>Read Excel</span>
                    {isUploading && (
                        <FiLoader className="ml-2 inline-block h-6 w-6 text-dominofy-light-accent animate-spin" />
                    )}
                </div>
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
                                onClick={handleRemove}
                                className="p-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isUploading}
                            >
                                <FiX className="rotate-45 w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                title="Choose Excel File"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-dominofy-light-accent text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span className="font-medium">Uploading...</span>
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
                                accept=".xlsx,.xls"
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
