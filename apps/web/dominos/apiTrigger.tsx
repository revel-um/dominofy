import {
  NodeProps,
  useUpdateNodeInternals,
  useReactFlow,
} from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { FiAlertCircle } from 'react-icons/fi';
import { useDomino } from '../contexts/dominoContext';
import { config } from '../config/config';

export default function ApiTriggerDomino({ data, id, selected }: NodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isValueConnected = data?.valueConnected ?? false;

  /* graph helpers */
  const { getEdges, setEdges } = useReactFlow();

  /* ---------------- helpers ---------------- */
  const getInitialFunctionValue = (): string => {
    const field = data?.details?.fields?.find(
      (f: DominoField) => f.heading === 'Function'
    );
    return typeof field?.value === 'string' ? field.value : '';
  };

  /* ---------------- state ---------------- */
  const [value, setValue] = useState(getInitialFunctionValue());

  /* derive checkbox state */
  const requireFileUpload =
    data?.details?.fields?.some(
      (f: DominoField) => f.heading === 'Require File Upload' && f.value === true
    ) ?? false;

  const requireBody =
    data?.details?.fields?.some(
      (f: DominoField) => f.heading === 'Require Body' && f.value === true
    ) ?? false;

  const showValueOutPin = requireFileUpload || requireBody;

  /* tell React Flow to re-measure when handles change */
  useEffect(() => updateNodeInternals(id), [showValueOutPin, id]);

  /* 🔪 prune edges + clear downstream flags when value_out disappears */
  useEffect(() => {
    if (showValueOutPin) return; // pin still visible → nothing to do

    const edges = getEdges();
    const edgesToRemove = edges.filter(
      (e) =>
        (e.source === id && e.sourceHandle === 'value_out') ||
        (e.target === id && e.targetHandle === 'value_out')
    );

    if (!edgesToRemove.length) return; // nothing to drop

    const detachedTargetIds = edgesToRemove
      .filter((e) => e.source === id)
      .map((e) => e.target);

    /* 1️⃣ drop the edges */
    setEdges(edges.filter((e) => !edgesToRemove.includes(e)));

    /* 2️⃣ clear flags on downstream nodes */
    data.setNodes?.((nodes: any[]) =>
      nodes.map((node) => {
        if (!detachedTargetIds.includes(node.id)) return node;

        return {
          ...node,
          data: {
            ...node.data,
            valueConnected: false,
            details: {
              ...node.data.details,
              fields: node.data.details.fields.map((field: any) =>
                field.connectedValue === id
                  ? { ...field, connectedValue: null }
                  : field
              ),
            },
          },
        };
      })
    );

    /* 3️⃣ re-measure this node and targets */
    updateNodeInternals(id);
    detachedTargetIds.forEach((tid) => updateNodeInternals(tid));
  }, [showValueOutPin, id, getEdges, setEdges]);

  /* sync value from details.fields */
  useEffect(() => {
    const field = data?.details?.fields?.find(
      (f: DominoField) => f.heading === 'Function'
    );
    if (field && field.value !== value) {
      setValue(field.value);
    }
  }, [data?.details?.fields]);

  /* initialize / patch node data */
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, newValue: any) => {
        if (heading === 'Function') setValue(newValue);

        data.setNodes?.((nodes: any[]) =>
          nodes.map((n) => {
            if (n.id !== id) return n;

            const updatedFields = n.data.details.fields.map(
              (field: DominoField) => {
                if (field.heading === heading) {
                  return { ...field, value: newValue };
                }
                if (field.heading === 'Api Url' && heading === 'Function') {
                  return {
                    ...field,
                    value: `${config.backendBaseUrl}/workflow/${n.data.workflowId}/trigger/` + newValue,
                  };
                }
                return field;
              }
            );

            return {
              ...n,
              data: {
                ...n.data,
                details: { ...n.data.details, fields: updatedFields },
              },
            };
          })
        );
      };

      data.setNodes((prevNodes: any[]) =>
        prevNodes.map((node) => {
          if (node.id !== id) return node;

          const baseFields: DominoField[] =
            node.data.details?.fields ?? [
              {
                type: 'copy',
                heading: 'Api Url',
                required: true,
                value: `${config.backendBaseUrl}/workflow/${node.data.workflowId}/trigger/` + value,
              },
              {
                type: 'textInput',
                placeholder: 'Enter trigger name...',
                value: value,
                required: true,
                heading: 'Function',
                onChange: (val: string) => {
                  val = val.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '');
                  return /^[0-9]/.test(val) ? val.slice(1) : val;
                },
              },
            ];

          const checkboxFields: DominoField[] = [
            {
              type: 'checkbox',
              heading: 'Require File Upload',
              required: false,
              value:
                node.data.details?.fields?.find(
                  (f: { heading: string }) =>
                    f.heading === 'Require File Upload'
                )?.value ?? false,
            },
            {
              type: 'checkbox',
              heading: 'Require Body',
              required: false,
              value:
                node.data.details?.fields?.find(
                  (f: { heading: string }) => f.heading === 'Require Body'
                )?.value ?? false,
            },
          ];

          const fields = [
            ...baseFields.filter(
              (f) => !checkboxFields.some((cb) => cb.heading === f.heading)
            ),
            ...checkboxFields,
          ];

          const details: DominoNodeData = { 
            type: 'ApiTrigger',
            description: 'You can start this workflow by visiting a special link using this domino.',
            isTrigger: true,
            ...node.data.details, fields
          };

          return {
            ...node,
            data: {
              ...node.data,
              details,
              exportFields: ['Function', 'Require File Upload', 'Require Body'],
              setFieldValue,
            },
          };
        })
      );
    }
  }, [data, id, value]);

  /* handlers */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearValidationForDominoId(id);
    let rawValue = e.target.value
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '');
    if (/^[0-9]/.test(rawValue)) rawValue = rawValue.slice(1);

    setValue(rawValue);
    data.setFieldValue?.('Function', rawValue);
    return rawValue;
  };

  /* render */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4'
            : 'unselected-border dark:border-gray-600'
        }
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      <div
        className="relative px-3 py-2 text-sm font-semibold text-white border-b"
        style={{ backgroundColor: '#8b5cf6', borderBottomColor: '#7c3aed' }}
      >
        API Trigger
        {hasError && (
          <FiAlertCircle
            className="absolute right-2 top-2 w-4 h-4 text-red-300"
            title="Missing execution input"
          />
        )}
      </div>

      {!isValueConnected && (
        <div className="px-3 py-2">
          <input
            type="text"
            placeholder="Enter trigger name..."
            value={value}
            onChange={handleChange}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          />
          {hasError && (
            <p className="mt-1 text-xs text-red-500">
              ⚠️ Value input pin is connected but execution pin is missing.
            </p>
          )}
        </div>
      )}

      {/* Exec-out is always present */}
      <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} />
      {/* Value-out appears only when at least one checkbox is checked */}
      {showValueOutPin && (
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} />
      )}
    </div>
  );
}
