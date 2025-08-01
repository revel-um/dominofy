// src/dominos/ShopifyDomino.tsx
import { NodeProps, useEdges } from 'reactflow';
import React, { useState, useEffect } from 'react';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoFieldOption, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

// Extend DominoNodeData for Shopify
export interface ShopifyDominoData extends DominoNodeData {
  shopDomain: string;
  accessTokenVaultId: string;
  resource: string;
  operation: string;
  parameters: Record<string, any>;
}

type ShopifyField = {
  key: keyof ShopifyDominoData;
  label: string;
  value: string;
  pinId: string;
  required: boolean;
  isTextArea?: boolean;
  options?: DominoFieldOption[];
};

const resourceOptions: DominoFieldOption[] = [
  { label: 'Product', value: 'products' },
  { label: 'Order', value: 'orders' },
  { label: 'Customer', value: 'customers' },
];

const operationOptions: DominoFieldOption[] = [
  { label: 'Get', value: 'get' },
  { label: 'List', value: 'list' },
  { label: 'Create', value: 'create' },
  { label: 'Update', value: 'update' },
  { label: 'Delete', value: 'delete' },
];

export default function ShopifyDomino({ data, id, selected }: NodeProps<ShopifyDominoData>) {
  const edges = useEdges();
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  // Initialize fields state
  const [fields, setFields] = useState<ShopifyField[]>(() => {
    const saved = data.details?.fields ?? [];
    const find = (heading: string) =>
      String(saved.find((f: { heading: string; }) => f.heading === heading)?.value ?? (data as any)[heading] ?? '');

    return [
      { key: 'shopDomain', label: 'Shop Domain', value: find('shopDomain'), pinId: 'value_shopDomain', required: true },
      { key: 'accessTokenVaultId', label: 'Access Token (Vault Id)', value: find('accessTokenVaultId'), pinId: 'value_accessTokenVaultId', required: true },
      { key: 'resource', label: 'Resource', value: find('resource'), pinId: 'value_resource', required: true, options: resourceOptions },
      { key: 'operation', label: 'Operation', value: find('operation'), pinId: 'value_operation', required: true, options: operationOptions },
      { key: 'parameters', label: 'Parameters (JSON)', value: find('parameters'), pinId: 'value_parameters', required: false, isTextArea: true },
    ];
  });

  // Clear values when pin connects
  useEffect(() => {
    let clearedAny = false;
    const newFields = fields.map(f => {
      const connected = edges.some(edge => edge.target === id && edge.targetHandle === f.pinId);
      if (connected && f.value !== '') {
        clearedAny = true;
        return { ...f, value: '' };
      }
      return f;
    });
    if (clearedAny) setFields(newFields);
  }, [edges, fields, id]);

  const handleChange = (key: keyof ShopifyDominoData, value: string) => {
    clearValidationForDominoId(id);
    setFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
  };

  // Sync to node data and details
  useEffect(() => {
    if (!data.setNodes) return;

    data.setNodes((nds: any[]) =>
      nds.map((node: any) => {
        if (node.id !== id) return node;

        // Update raw data on node
        fields.forEach(f => {
          const connected = edges.some(edge => edge.target === id && edge.targetHandle === f.pinId);
          if (!connected) {
            if (f.key === 'parameters') {
              try { node.data.parameters = JSON.parse(f.value); } catch { node.data.parameters = {}; }
            } else {
              node.data[f.key] = f.value;
            }
          }
        });

        const existing: DominoField[] = node.data.details?.fields ?? [];
        const newFields: DominoField[] = fields.map(f => {
          const connected = edges.some(edge => edge.target === id && edge.targetHandle === f.pinId);
          const df: DominoField = {
            heading: f.label,
            value: connected ? '' : f.value,
            inPinId: f.pinId,
            type: f.isTextArea ? 'textArea' : f.options ? 'dropdown' : 'textInput',
            required: f.required,
            shouldRender: false,
            connectedValue: connected ? 'connected' : '',
          };
          if (f.options) (df as any).options = f.options;
          return df;
        });

        // Avoid infinite loops by skipping identical
        if (JSON.stringify(existing) === JSON.stringify(newFields)) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            details: { ...node.data.details, fields: newFields },
            exportFields: newFields.map(f => f.heading),
          },
        };
      })
    );
  }, [fields, edges, data.setNodes, id]);

  const renderField = (f: ShopifyField) => {
    const connected = edges.some(edge => edge.target === id && edge.targetHandle === f.pinId);
    const base = "mt-1 w-full px-2 py-1 text-sm border rounded";

    return (
      <div key={f.key} className="flex items-center gap-2 relative px-3">
        <DominoPin id={f.pinId} pinType={PinType.VALUE_IN} inline />
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {f.isTextArea ? (
            <textarea
              value={f.value}
              onChange={e => handleChange(f.key, e.target.value)}
              placeholder={connected ? 'Connected' : f.label}
              readOnly={connected}
              disabled={connected}
              rows={3}
              className={`${base} bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text`}
            />
          ) : f.options ? (
            <select
              value={f.value}
              onChange={e => handleChange(f.key, e.target.value)}
              disabled={connected}
              className={`${base} bg-white dark:bg-gray-700`}
            >
              <option value="">Select</option>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={f.value}
              onChange={e => handleChange(f.key, e.target.value)}
              placeholder={connected ? 'Connected' : f.label}
              readOnly={connected}
              disabled={connected}
              className={`${base} bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text`}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`relative transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md"
        style={{ backgroundColor: '#6366f1', borderBottomColor: '#4f46e5' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Shopify</span>
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      <div className="flex flex-col gap-2 pb-2 pt-2">
        {fields.map(renderField)}
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ One or more required fields are missing or an input pin is connected without a value.
        </p>
      )}
    </div>
  );
}
