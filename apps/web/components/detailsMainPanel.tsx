'use client';

import React from 'react';
import { DominoField, fieldWidgetMap } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { Node } from 'reactflow';

interface Props {
    selectedNode?: Node;
    width: number;
    onClose: () => void;
}

export default function DetailsMainPanel({ selectedNode, width, onClose }: Props) {
    const { clearValidationForDominoId } = useDomino();

    return (
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6" style={{ width }}>

            {/* Placeholder */}
            {!selectedNode && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select a domino on the canvas to view its settings.
                </p>
            )}

            {/* Fields */}
            {selectedNode?.data?.details && (
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-dominofy-light-text dark:text-dominofy-dark-text">
                        {selectedNode.data.details.type}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">{selectedNode.data.details.description}</p>

                    <div className="space-y-5 pt-2">
                        {selectedNode.data.details.fields.map((f: DominoField, i: React.Key | null | undefined) => {
                            const Widget = fieldWidgetMap[f.type as keyof typeof fieldWidgetMap];
                            if (!Widget || f.shouldRender === false) return null;
                            return (
                                <div key={i} className="flex flex-col space-y-1">
                                    {f.heading && (
                                        <label className="font-medium text-sm text-dominofy-light-text dark:text-dominofy-dark-text">
                                            {f.heading}
                                        </label>
                                    )}
                                    <Widget
                                        value={f.value}
                                        options={f.options}
                                        placeholder={f.placeholder}
                                        required={f.required}
                                        onChange={(val: any) => {
                                            if (f.onChange) val = f.onChange(val);
                                            clearValidationForDominoId(selectedNode.id);
                                            selectedNode.data.setFieldValue(f.heading, val);
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Raw JSON */}
            {selectedNode?.data && (
                <div>
                    <p className="text-xs text-gray-500 mb-1">Raw Data</p>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                        {JSON.stringify(selectedNode.data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
