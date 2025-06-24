import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useState, useEffect } from 'react';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';

/* ───────────────────────────────────────────────
   Types
──────────────────────────────────────────────── */
type CaseRow = {
  id: number | 'default';   // stable key
  value: string;            // label shown in the input
};

/* ───────────────────────────────────────────────
   Component
──────────────────────────────────────────────── */
export default function SwitchDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* ============ local state ============
     Hydrate directly from saved node data,
     so we never render a truncated field list. */
  const [cases, setCases] = useState<CaseRow[]>(() => {
    const saved: any[] = data?.details?.fields ?? [];

    const initial: CaseRow[] = [{ id: 'default', value: '' }];

    saved.forEach(f => {
      if (f.heading === 'Case_Default') {
        initial[0].value = String(f.value ?? '');
      } else {
        const m = /^Case_(\d+)$/.exec(f.heading);
        if (m) {
          initial.push({ id: Number(m[1]), value: String(f.value ?? '') });
        }
      }
    });

    return initial;
  });

  /* ---------- add / remove / edit ---------- */
  const addInput = () => {
    clearValidationForDominoId(id);
    setCases(prev => {
      const nextId =
        Math.max(
          0,
          ...prev
            .filter(r => typeof r.id === 'number')
            .map(r => r.id as number),
        ) + 1;
      return [...prev, { id: nextId, value: '' }];
    });
  };

  const removeInput = (rowId: number | 'default') => {
    if (rowId === 'default') return; // default row can’t be removed
    clearValidationForDominoId(id);
    setCases(prev => prev.filter(r => r.id !== rowId));
  };

  const handleInputChange = (
    rowId: number | 'default',
    newVal: string,
  ) => {
    clearValidationForDominoId(id);
    setCases(prev =>
      prev.map(r => (r.id === rowId ? { ...r, value: newVal } : r)),
    );
  };

  /* ============ push state → node.data ============ */
  useEffect(() => {
    if (!data.setNodes) return;

    data.setNodes((nodes: any[]) =>
      nodes.map((node: any) => {
        if (node.id !== id) return node;

        const existing: Record<string, any> = Object.fromEntries(
          (node.data?.details?.fields ?? []).map((f: any) => [
            f.heading,
            f,
          ]),
        );

        const ensureInput = existing['Input'] ?? {
          type: 'text',
          inPinId: 'value_in',
          shouldRender: false,
          heading: 'Input',
          required: true,
        };

        const newFields = [
          { ...ensureInput },
          ...cases.map(row => {
            const heading =
              row.id === 'default' ? 'Case_Default' : `Case_${row.id}`;
            const old = existing[heading] ?? {};
            return {
              ...old, // preserves connectedValue, inPinId, etc.
              value: row.value,
              heading,
              inPinId:
                row.id === 'default'
                  ? old.inPinId // usually undefined
                  : old.inPinId ?? `value_in_${row.id}`,
              shouldRender: false,
              required: row.id !== 'default',
            };
          }),
        ];

        return {
          ...node,
          data: {
            ...node.data,
            details: { ...node.data.details, fields: newFields },
            exportFields: newFields.map((f: any) => f.heading),
          },
        };
      }),
    );
  }, [cases, data.setNodes, id]);

  /* ============ render ============ */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-hidden shadow-sm
        ${
          hasError
            ? 'border-red-500 border-4'
            : selected
            ? 'selected-border border-4'
            : 'unselected-border dark:border-gray-600'
        }
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* header */}
      <div
        className="relative px-3 py-2 text-sm font-semibold text-white border-b"
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#4f46e5',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        Switch
      </div>

      {/* main input */}
      <div className="px-3 py-2">
        <div className="text-white">
          Input
          <DominoPin
            id="value_in"
            pinType={PinType.VALUE_IN}
            pinPosition="60px"
          />
        </div>
      </div>

      {/* cases */}
      <div className="px-3 py-2">
        {cases.map((row, idx) => (
          <div key={row.id} className="mb-1 flex items-center">
            <input
              type="text"
              value={row.id === 'default' ? 'Default' : row.value}
              onChange={e => handleInputChange(row.id, e.target.value)}
              placeholder={
                row.id === 'default' ? 'Default' : `Case ${row.id}`
              }
              readOnly={row.id === 'default'}
              disabled={row.id === 'default'}
              className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />

            {/* exec-out pin */}
            <DominoPin
              id={`exec_out_${
                row.id === 'default' ? 'default' : row.id
              }`}
              pinType={PinType.EXEC_OUT}
              pinPosition={`calc(${idx * 34}px + 102px)`}
            />

            {/* value-in pin (non-default only) */}
            {row.id !== 'default' && (
              <DominoPin
                id={`value_in_${row.id}`}
                pinType={PinType.VALUE_IN}
                pinPosition={`calc(${idx * 34}px + 102px)`}
              />
            )}

            {/* trash */}
            {row.id !== 'default' && (
              <button
                onClick={() => removeInput(row.id)}
                className="ml-2 p-1 bg-red-500 text-white rounded"
              >
                <Trash size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* add case button */}
      <div className="px-3 py-2">
        <button
          onClick={addInput}
          className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Add Input
        </button>
      </div>

      {/* exec-in pin */}
      <DominoPin id="exec_in" pinType={PinType.EXEC_IN} pinPosition="20px" />

      {hasError && (
        <p className="mt-1 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is missing.
        </p>
      )}
    </div>
  );
}
