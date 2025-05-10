import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';

export default function ApiTriggerDomino({ data, id, selected }: NodeProps) {
    const isValueConnected = data?.valueConnected ?? false;
    const [value, setValue] = useState('');

    useEffect(() => {
        if (!data.details && data.setNodes) {
            data.setNodes((prevNodes: { id: string; data: any }[]) => {
                return prevNodes.map((node) => {
                    if (node.id === id) {
                        const setFieldValue = (heading: string, newValue: any) => {
                            setValue(newValue);

                            data.setNodes?.((nodes: any[]) =>
                                nodes.map((n) => {
                                    if (n.id !== id) return n;

                                    const updatedFields = n.data.details.fields.map((field: DominoField) => {
                                        if (field.heading === heading) {
                                            return { ...field, value: newValue };
                                        }
                                        if (field.heading === 'Api Url') {
                                            return {
                                                ...field,
                                                value: 'https://api.dominofy.com/trigger/' + newValue,
                                            };
                                        }
                                        return field;
                                    });

                                    return {
                                        ...n,
                                        data: {
                                            ...n.data,
                                            details: {
                                                ...n.data.details,
                                                fields: updatedFields,
                                            },
                                        },
                                    };
                                })
                            );
                        };

                        const details: DominoNodeData = {
                            type: 'ApiTrigger',
                            description: 'This domino triggers execution via a unique API.',
                            fields: [
                                {
                                    type: 'copy',
                                    heading: 'Api Url',
                                    required: true,
                                    value: 'https://api.dominofy.com/trigger/' + value,
                                },
                                {
                                    type: 'textInput',
                                    placeholder: 'Enter function name...',
                                    value: value,
                                    required: true,
                                    heading: 'Function',
                                },
                            ],
                        };

                        return {
                            ...node,
                            data: {
                                ...node.data,
                                details,
                                setFieldValue, // ✅ inject correctly
                            },
                        };
                    }

                    return node;
                });
            });
        }
    }, [data, id, value]);

    // ✅ FIXED: Use setFieldValue instead of mutating fields manually
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);

        if (data.setFieldValue) {
            data.setFieldValue('Function', newValue);
        }

        return newValue;
    };

    return (
        <div
            className={`transition-all duration-150
        ${selected ? 'rounded-md border-4 w-56 overflow-hidden shadow-sm selected-border' : 'rounded-md w-56 overflow-hidden shadow-sm unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
        >
            <div
                className="px-3 py-2 text-sm font-semibold text-white border-b"
                style={{ backgroundColor: '#8b5cf6', borderBottomColor: '#7c3aed' }}
            >
                API Trigger
            </div>

            {!isValueConnected && (
                <div className="px-3 py-2">
                    <input
                        type="text"
                        placeholder="Enter function name..."
                        value={value ?? ''}
                        onChange={handleChange}
                        className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                    />
                </div>
            )}

            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} />
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} />
        </div>
    );
}
