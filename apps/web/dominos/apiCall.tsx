import React, { useEffect, useState } from 'react';
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoNodeData, DominoField } from '../types/dominoFieldTypes';

export default function ApiCallDomino({ data, id, selected }: NodeProps) {
    const [url, setUrl] = useState(data.url ?? '');

    useEffect(() => {
        if (!data.details && data.setNodes) {
            data.setNodes((prevNodes: any[]) => {
                return prevNodes.map((node) => {
                    if (node.id === id) {
                        const setFieldValue = (heading: string, newValue: any) => {
                            setUrl(newValue);
                            data.setNodes?.((nodes: any[]) =>
                                nodes.map((n) =>
                                    n.id === id
                                        ? {
                                            ...n,
                                            data: {
                                                ...n.data,
                                                url: heading === 'URL' ? newValue : n.data.url,
                                                details: {
                                                    ...n.data.details,
                                                    fields: n.data.details.fields.map((field: DominoField) =>
                                                        field.heading === heading
                                                            ? { ...field, value: newValue }
                                                            : field
                                                    ),
                                                },
                                            },
                                        }
                                        : n
                                )
                            );
                        };

                        const details: DominoNodeData = {
                            type: 'ApiCall',
                            description: 'This domino sends an HTTP request to a specified URL with optional headers and body.',
                            fields: [
                                {
                                    type: 'textInput',
                                    heading: 'URL',
                                    placeholder: 'https://api.example.com',
                                    value: data.url ?? '',
                                    required: true,
                                },
                                {
                                    type: 'dropdown',
                                    heading: 'Method',
                                    value: data.method ?? 'GET',
                                    required: true,
                                    options: [
                                        { label: 'GET', value: 'GET' },
                                        { label: 'POST', value: 'POST' },
                                        { label: 'PUT', value: 'PUT' },
                                        { label: 'DELETE', value: 'DELETE' },
                                    ],
                                },
                                {
                                    type: 'json',
                                    heading: 'Headers',
                                    placeholder: '{"Authorization": "Bearer xyz"}',
                                    value: data.headers ?? '',
                                },
                                {
                                    type: 'json',
                                    heading: 'Body',
                                    placeholder: '{"key": "value"}',
                                    value: data.body ?? '',
                                },
                            ],
                        };

                        return {
                            ...node,
                            data: {
                                ...node.data,
                                details,
                                setFieldValue,
                            },
                        };
                    }
                    return node;
                });
            });
        }
    }, [data, id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);

        if (data.setNodes) {
            data.setNodes((prevNodes: any[]) =>
                prevNodes.map((node) =>
                    node.id === id
                        ? {
                            ...node,
                            data: {
                                ...node.data,
                                url: newUrl,
                            },
                        }
                        : node
                )
            );
        }
    };

    return (
        <div className={`transition-all duration-150
            ${selected ? 'rounded-md border-4 w-56 overflow-hidden shadow-sm selected-border' : 'rounded-md w-56 overflow-hidden shadow-sm unselected-border dark:border-gray-600'}
            bg-dominofy-light-panel dark:bg-dominofy-dark-panel`
        }>
            <div
                className="px-3 py-2 text-sm font-semibold text-white border-b"
                style={{
                    backgroundColor: '#10b981',
                    borderBottomColor: '#059669',
                }}
            >
                API Call
            </div>

            <div className="px-3 py-2">
                <input
                    type="text"
                    placeholder="https://api.example.com"
                    value={url}
                    onChange={handleChange}
                    className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                />
            </div>

            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} />
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} />
        </div>
    );
}
