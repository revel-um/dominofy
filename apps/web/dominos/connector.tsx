// src/dominos/connector.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useState, useEffect } from 'react';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';
import { DominoField } from '../types/dominoFieldTypes';

/* ───────────────────────── Types */
type CaseRow = {
  id: any;
  value: string;
};

/* ───────────────────────── Component */
export default function ConnectorDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* hydrate cases from node data */
  const [cases, setCases] = useState<CaseRow[]>(() => {
    const saved: any[] = data?.details?.fields ?? [];
    const rows: CaseRow[] = [{ id: '', value: '' }];
    saved.forEach(f => {
      
      const m = /^Case_(\d+)$/.exec(f.heading);
      if (m) rows.push({ id: Number(m[1]), value: String(f.value ?? '') });
      
    });
    return rows;
  });

  /* ───────── handlers */
  const addInput = () => {
    clearValidationForDominoId(id);
    setCases(prev => {
      const nextId = Math.max(0, ...prev.filter(r => typeof r.id === 'number').map(r => r.id as number)) + 1;
      return [...prev, { id: nextId, value: '' }];
    });
  };

  const removeInput = (rowId: number) => {
    clearValidationForDominoId(id);

    setCases(prev => {
      // 1️⃣ drop the requested row
      const remaining = prev.filter(r => r.id !== rowId);

      // 2️⃣ renumber non-default rows so they’re 1,2,3…
      let counter = 1;
      return remaining.map(r =>
        r.id === 0 ? r : { ...r, id: counter++ }
      );
    });
  };

  const handleInputChange = (rowId: number , v: string) => {
    clearValidationForDominoId(id);
    setCases(prev => prev.map(r => (r.id === rowId ? { ...r, value: v } : r)));
  };

  /* push → node */
  useEffect(() => {
    if (!data.setNodes) return;

    data.setNodes((nodes: any[]) =>
      nodes.map((n: { id: string; data: { details: { fields: any; }; }; }) => {
        if (n.id !== id) return n;
        const existing: Record<string, any> = Object.fromEntries(
          (n.data.details?.fields ?? []).map((f: any) => [f.heading, f])
        );
        const ensureInput = existing['Input'] ?? {
          type: 'text',
          heading: 'Input',
          required: true,
          inPinId: 'value_in',
          shouldRender: false,
        };

        const newFields = [ensureInput, ...cases.map(row => {
          const heading = `Case_${row.id}`;
          const old = existing[heading] ?? {};
          return {
            ...old,
            heading,
            value: row.value,
            inPinId: old.inPinId ?? `value_in_${row.id}`,
            shouldRender: false,
            required: true,
          };
        })];

        return {
          ...n,
          data: {
            ...n.data,
            details: { ...n.data.details, fields: newFields },
            exportFields: newFields.map(f => f.heading),
          },
        };
      })
    );
  }, [cases, data.setNodes, id]);

  /* ───────── render */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{ backgroundColor: '#6366f1', borderBottomColor: '#4f46e5', borderRadius: '0.23rem 0.23rem 0 0' }}
      >
        <div className="flex items-center gap-1">
          <span>Connector/Merger</span>
        </div>
      </div>

      {/* cases list */}
      <div className="flex flex-col gap-2">
        {cases.map((row, idx) => (
          <div key={row.id} className="flex items-center gap-2 relative px-3">
            
            <DominoPin id={`exec_in_${row.id}`} pinType={PinType.EXEC_IN} inline />
            

            <input
              type="text"
              value={row.value}
              placeholder={`Input ${row.id}`}
              readOnly
              disabled
              onChange={e => handleInputChange(row.id, e.target.value)}
              className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />

            
            {row.id !== 0 && (
              <button
                onClick={() => removeInput(row.id as number)}
                className="p-1 bg-red-500 text-white rounded ml-1"
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* add case */}
      <div className="px-3 py-2">
        <button
          onClick={addInput}
          className="px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Add Inputs
        </button>
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">⚠️ Value input pin is connected but execution pin is missing.</p>
      )}
    </div>
  );
}
