import React from 'react';
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';

export default function ApiCallDomino({ data, id, selected }: NodeProps) {
    const handleChange = (field: string, value: string) => {
        if (data.setNodes) {
            data.setNodes((prevNodes: any[]) => {
                const updatedNodes = prevNodes.map((node) =>
                    node.id === id
                        ? {
                            ...node,
                            data: {
                                ...node.data,
                                [field]: value,
                            },
                        }
                        : node
                );

                // ✅ Trigger pipeline rebuild
                if (data.updatePipeline) {
                    setTimeout(() => data.updatePipeline(updatedNodes), 0);
                }

                return updatedNodes;
            });
        }
    };


    return (
        <div className={`rounded-md border border-gray-400
        dark:border-gray-600 bg-dominofy-light-panel
        dark:bg-dominofy-dark-panel w-64 shadow-sm overflow-hidden
        ${selected ? 'rounded-md border-4 w-56 overflow-hidden shadow-sm selected-border' : 'rounded-md w-56 overflow-hidden shadow-sm unselected-border dark:border-gray-600'}
        `}>
            <div
                className="px-3 py-2 text-sm font-semibold text-white border-b"
                style={{
                    backgroundColor: '#10b981',
                    borderBottomColor: '#059669',
                }}
            >
                API Call
            </div>

            <div className="px-3 py-2 space-y-4 text-sm"> {/* ⬅️ increased spacing */}
                <input
                    type="text"
                    placeholder="https://api.example.com"
                    value={data.url ?? ''}
                    onChange={(e) => handleChange('url', e.target.value)}
                    className="w-full px-2 py-1 border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                />

                <select
                    value={data.method ?? 'GET'}
                    onChange={(e) => handleChange('method', e.target.value)}
                    className="w-full px-2 py-1 border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                </select>

                <textarea
                    placeholder='Headers (JSON), e.g. {"Authorization": "Bearer xyz"}'
                    value={data.headers ?? ''}
                    onChange={(e) => handleChange('headers', e.target.value)}
                    className="w-full px-2 py-1 border rounded resize-none bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                    rows={3}
                />

                <textarea
                    placeholder='Body (JSON), e.g. {"name": "Utsav"}'
                    value={data.body ?? ''}
                    onChange={(e) => handleChange('body', e.target.value)}
                    className="w-full px-2 py-1 border rounded resize-none bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                // rows={3}
                />
            </div>


            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} />
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} />
        </div>
    );
}
