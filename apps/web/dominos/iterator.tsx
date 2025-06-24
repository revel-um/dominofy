// src/dominos/iterator.tsx
import { NodeProps } from 'reactflow';
import { useEffect, useState, useCallback, useRef } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function IteratorDomino({ data, id, selected }: NodeProps) {
    const { erroredNodes, clearValidationForDominoId } = useDomino();
    const hasError = erroredNodes.includes(id);

    /* ───────────────────────────────────────── helpers */
    const getField = (heading: string) =>
        (data.details as DominoNodeData | undefined)?.fields?.find(
            f => f.heading === heading,
        ) as any | undefined;

    const updateFieldValue = useCallback(
        (heading: string, value: any) => {
            if (!data.setNodes) return;
            data.setNodes((prev: any[]) =>
                prev.map((node: { id: string; data: { details: DominoNodeData; }; }) => {
                    if (node.id !== id) return node;
                    const details = node.data.details as DominoNodeData;
                    const updatedFields = details.fields.map(field =>
                        field.heading === heading ? { ...field, value } : field,
                    );
                    return {
                        ...node,
                        data: { ...node.data, details: { ...details, fields: updatedFields } },
                    };
                }),
            );
        },
        [data.setNodes, id],
    );

    /* ───────────────────────────────────────── state */
    const [order, setOrder] = useState<'forward' | 'reverse'>(
        (getField('Order')?.value as 'forward' | 'reverse') ?? 'forward',
    );
    const [limit, setLimit] = useState<string>((getField('Limit')?.value as string) ?? '');
    const [isMax, setIsMax] = useState<boolean>(
        getField('Max')?.value !== undefined ? Boolean(getField('Max')?.value) : false,
    );

    /* ───────────────────────────────────────── connection status */
    const isInputConnected = Boolean(getField('Input')?.connectedValue);

    /* ───────────────────────────────────────── react to connection changes
       - rising edge: auto-check Max & clear Limit
       - falling edge: auto-uncheck Max                                        */
    const prevConnectedRef = useRef(isInputConnected);
    useEffect(() => {
        const wasConnected = prevConnectedRef.current;

        // connected just now
        if (isInputConnected && !wasConnected) {
            setIsMax(true);
            updateFieldValue('Max', true);
            if (limit !== '') {
                setLimit('');
                updateFieldValue('Limit', '');
            }
        }

        // disconnected just now
        if (!isInputConnected && wasConnected) {
            setIsMax(false);
            updateFieldValue('Max', false);
        }

        prevConnectedRef.current = isInputConnected;
    }, [isInputConnected, limit, updateFieldValue]);

    /* ───────────────────────────────────────── one-time bootstrap */
    useEffect(() => {
        if (!data.details && data.setNodes) {
            data.setNodes((prev: any[]) =>
                prev.map((node: { id: string; data: any; }) =>
                    node.id !== id
                        ? node
                        : {
                            ...node,
                            data: {
                                ...node.data,
                                details: {
                                    type: 'Iterator',
                                    description: 'Iterates over an array and emits each element.',
                                    fields: [
                                        {
                                            type: 'text',
                                            heading: 'Input',
                                            placeholder: '',
                                            value: '',
                                            inPinId: 'value_in',
                                            required: true,
                                            shouldRender: false
                                        } as DominoField,
                                        {
                                            type: 'dropdown',
                                            heading: 'Order',
                                            value: 'forward',
                                            required: true,
                                            shouldRender: false,
                                            options: [
                                                { label: 'Forward', value: 'forward' },
                                                { label: 'Reverse', value: 'reverse' },
                                            ],
                                        } as DominoField,
                                        {
                                            type: 'textInput',
                                            heading: 'Limit',
                                            placeholder: '',
                                            value: '',
                                            required: false,
                                            shouldRender: false
                                        } as DominoField,
                                        {
                                            type: 'checkbox',
                                            heading: 'Max',
                                            value: false, // default true
                                            required: false,
                                            shouldRender: false
                                        } as DominoField,
                                    ],
                                } as DominoNodeData,
                                exportFields: ['Input', 'Order', 'Max', 'Limit'],
                            },
                        },
                ),
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ───────────────────────────────────────── handlers */
    const handleOrderChange = (val: 'forward' | 'reverse') => {
        clearValidationForDominoId(id);
        setOrder(val);
        updateFieldValue('Order', val);
    };

    const handleLimitChange = (val: string) => {
        clearValidationForDominoId(id);
        setLimit(val);
        updateFieldValue('Limit', val);
    };

    const handleMaxToggle = (checked: boolean) => {
        clearValidationForDominoId(id);
        setIsMax(checked);
        updateFieldValue('Max', checked);
        if (checked) {
            setLimit('');
            updateFieldValue('Limit', '');
        }
    };

    /* ───────────────────────────────────────── render */
    return (
        <div
            style={{ minWidth: '13rem' }}   // 240 px – between 56 (224 px) and 64 (256 px)
            className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
      ${hasError
                    ? 'error-border'
                    : selected
                        ? 'selected-border border-4'
                        : 'unselected-border dark:border-gray-600'
                }
      bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
        >
            {/* Header */}
            <div
                className="flex justify-between px-3 py-2 text-sm font-semibold text-white border-b"
                style={{ backgroundColor: '#6366f1', borderBottomColor: '#4f46e5' }}
            >
                <span className="truncate">Iterator</span>

                <div style={{ float: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div>For&nbsp;each</div>
                    <div>On&nbsp;complete</div>
                </div>
            </div>



            {/* Input label */}
            <div className="px-3 py-2">
                <div className="text-white">
                    Input
                    <DominoPin id="value_in" pinType={PinType.VALUE_IN} pinPosition="80px" />
                </div>
            </div>

            {/* Order row */}
            <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
                    Order
                </span>
                <select
                    value={order}
                    onChange={e => handleOrderChange(e.target.value as 'forward' | 'reverse')}
                    className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface
                     text-dominofy-light-text dark:text-dominofy-dark-text mb-1"
                >
                    <option value="forward">Forward</option>
                    <option value="reverse">Reverse</option>
                </select>
            </div>

            {/* Limit + Max row */}
            <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">
                    Limit
                </span>

                {!isMax && (
                    <input
                        type="text"
                        value={limit}
                        inputMode="numeric"                 // mobile shows numeric keyboard
                        placeholder="Count"
                        className="w-20 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                        onChange={e => {
                            const raw = e.target.value;

                            // allow empty string so the user can erase & re-type
                            if (raw === '') {
                                handleLimitChange('');
                                return;
                            }

                            // accept only 1,2,3,… (no 0, no negatives, no decimals)
                            if (/^[1-9]\d*$/.test(raw)) {
                                handleLimitChange(raw);
                            }
                            // any other input is ignored
                        }}
                    />

                )}

                {isInputConnected && (
                    <label className="flex items-center gap-1 text-xs text-dominofy-light-text dark:text-dominofy-dark-text whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={isMax}
                            onChange={e => handleMaxToggle(e.target.checked)}
                            className="form-checkbox"
                        />
                        Max
                    </label>
                )}
            </div>

            {/* Pins */}
            <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition='11%' />
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} pinPosition='10%' />
            <DominoPin id="exec_out_1" pinType={PinType.EXEC_OUT} pinPosition='21%' />
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} pinPosition='50%' />
        </div>
    );
}
