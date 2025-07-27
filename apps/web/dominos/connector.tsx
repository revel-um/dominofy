// src/dominos/connector.tsx
import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useState, useEffect } from 'react';
import { useDomino } from '../contexts/dominoContext';
import { Trash } from 'lucide-react';

/* ───────────────────────── Types */
type CaseRow = {
  id: number;
  value: string;
};

/* ───────────────────────── Component */
export default function ConnectorDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* hydrate cases from node data */
  const [cases, setCases] = useState<CaseRow[]>(() => {
    const saved: any[] = data?.details?.fields ?? [];

    // always start with two default rows (0 & 1)
    const rowMap = new Map<number, string>([
      [0, ''],
      [1, ''],
    ]);

    saved.forEach(f => {
      const m = /^Case_(\d+)$/.exec(f.heading);
      if (m) rowMap.set(Number(m[1]), String(f.value ?? ''));
    });

    return Array.from(rowMap.entries())
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => a.id - b.id);
  });

  /* ───────── handlers */
  const addInput = () => {
    clearValidationForDominoId(id);
    setCases(prev => {
      const nextId = Math.max(...prev.map(r => r.id)) + 1;
      return [...prev, { id: nextId, value: '' }];
    });
  };

  const removeInput = (rowId: number) => {
    // keep the two defaults forever
    if (rowId < 2) return;

    clearValidationForDominoId(id);
    setCases(prev => {
      const remaining = prev.filter(r => r.id !== rowId);

      // renumber rows ≥ 2
      let counter = 2;
      return remaining.map(r =>
        r.id < 2 ? r : { ...r, id: counter++ },
      );
    });
  };

  /* push → node */
  useEffect(() => {
    if (!data.setNodes) return;

    data.setNodes((nodes: any[]) =>
      nodes.map((n: any) => {
        if (n.id !== id) return n;

        const existing: Record<string, any> = Object.fromEntries(
          (n.data.details?.fields ?? []).map((f: any) => [
            f.heading,
            f,
          ]),
        );

        const newFields = cases.map(row => {
          const heading = `Case_${row.id}`;
          const old = existing[heading] ?? {};
          return {
            ...old,
            heading,
            value: row.value,
            inPinId: old.inPinId ?? row.id == 0 ? 'exec_in' : `exec_in_${row.id}`,
            shouldRender: false,
            required: true,
          };
        });

        return {
          ...n,
          data: {
            ...n.data,
            details: { ...n.data.details, fields: newFields },
          },
        };
      }),
    );
  }, [cases, data.setNodes, id]);

  /* ───────── render */
  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border'
            : 'unselected-border dark:border-gray-600'
        }
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#4f46e5',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <span>Connector/Merger</span>
        </div>
        <DominoPin
          id="exec_out"
          pinType={PinType.EXEC_OUT}
          inline
        />
      </div>

      {/* rows */}
      <div className="flex flex-col gap-2 py-2">
        {cases.map(row => (
          <div
            key={row.id}
            className="flex items-center gap-2 relative px-3"
          >
            <DominoPin
              id={row.id == 0 ? 'exec_in' : `exec_in_${row.id}`}
              pinType={PinType.EXEC_IN}
              inline
            />

            {/* plain text instead of disabled input */}
            <span className="flex-1 px-2 py-1 text-sm rounded bg-transparent text-dominofy-light-text dark:text-dominofy-dark-text select-none">
              {row.value || `Input ${row.id + 1}`}
            </span>

            {row.id >= 2 && (
              <button
                onClick={() => removeInput(row.id)}
                className="p-1 bg-red-500 text-white rounded ml-1"
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* add input */}
      <div className="px-3 py-2">
        <button
          onClick={addInput}
          className="px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Add Inputs
        </button>
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Value input pin is connected but execution pin is
          missing.
        </p>
      )}
    </div>
  );
}
