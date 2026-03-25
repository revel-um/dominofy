// src/dominos/switch.tsx
import { NodeProps, useReactFlow } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
import { Trash, X } from 'lucide-react';
import { DominoField } from '../types/dominoFieldTypes';

/* ───────────────────────── Types */
type CaseRow = {
  id: number | 'default';
  value: string;
};

/* ───────────────────────── Component */
export default function SwitchDomino({ data, id, selected }: NodeProps) {
  // Ghost/shadow mode for AI-suggested dominos
  const isGhost = data.suggested === true;
  const setNodesRef = useRef(data.setNodes);
  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);

  // React Flow context
  const { getEdges } = useReactFlow();
  const edges = getEdges();

  // Domino validation context
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);

  /* hydrate cases from node data */
  const [cases, setCases] = useState<CaseRow[]>(() => {
    const saved: any[] = data?.details?.fields ?? [];
    const rows: CaseRow[] = [{ id: 'default', value: '' }];
    saved.forEach(f => {
      if (f.heading === 'Case_Default') {
        rows[0].value = String(f.value ?? '');
      } else {
        const m = /^Case_(\d+)$/.exec(f.heading);
        if (m) rows.push({ id: Number(m[1]), value: String(f.value ?? '') });
      }
    });
    return rows;
  });

  /* clear values when a pin becomes connected */
  useEffect(() => {
    let updated = false;
    const cleared = cases.map(r => {
      const pinId = r.id === 'default' ? 'value_in' : `value_in_${r.id}`;
      const isConnected = edges.some(
        edge => edge.target === id && edge.targetHandle === pinId
      );
      if (isConnected && r.value !== '') {
        updated = true;
        return { ...r, value: '' };
      }
      return r;
    });
    if (updated) setCases(cleared);
  }, [edges, cases, id]);

  /* ───────── handlers */
  const addInput = () => {
    clearValidationForDominoId(id);
    setCases(prev => {
      const nextId =
        Math.max(0, ...prev.filter(r => typeof r.id === 'number').map(r => r.id as number)) + 1;
      return [...prev, { id: nextId, value: '' }];
    });
  };

  const removeInput = (rowId: number) => {
    clearValidationForDominoId(id);
    setCases(prev => {
      const remaining = prev.filter(r => r.id !== rowId);
      let counter = 1;
      return remaining.map(r =>
        r.id === 'default' ? r : { ...r, id: counter++ }
      );
    });
  };

  const handleInputChange = (rowId: number | 'default', v: string) => {
    clearValidationForDominoId(id);
    setCases(prev => prev.map(r => (r.id === rowId ? { ...r, value: v } : r)));
  };

  // Accept (promote) suggested domino to normal
  const acceptSuggestion = useCallback(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;
    setNodes((nds: any[]) =>
      nds.map(n =>
        n.id === id
          ? { ...n, data: { ...n.data, suggested: false } }
          : n
      )
    );
  }, [id]);

  /* push → node (sync fields) */
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    setNodes((nds: any[]) =>
      nds.map((n: any) => {
        if (n.id !== id) return n;
        const existing: any[] = n.data.details?.fields ?? [];

        // build newFields
        const ensureInput = existing.find(f => f.heading === 'Input') ?? {
          type: 'text', heading: 'Input', required: true,
          inPinId: 'value_in', shouldRender: false
        };
        const newFields = [
          ensureInput,
          ...cases.map(row => {
            const heading = row.id === 'default'
              ? 'Case_Default'
              : `Case_${row.id}`;
            const old = existing.find(f => f.heading === heading) ?? {};
            return {
              ...old,
              heading,
              value: row.value,
              inPinId: row.id === 'default'
                ? undefined
                : (old.inPinId ?? `value_in_${row.id}`),
              shouldRender: false,
              required: row.id !== 'default',
            };
          }),
        ];

        // guard against unnecessary updates
        if (JSON.stringify(existing) === JSON.stringify(newFields)) {
          return n;
        }

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
  }, [cases, id]);

  /* ───────── render */
  return (
    <div
      className={`relative transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`
      }
      // style={{
      //   minWidth: '13rem',
      //   opacity: isGhost ? 0.4 : 1,
      //   filter: isGhost ? 'drop-shadow(0 0 8px rgba(0,0,0,0.5))' : undefined,
      //   pointerEvents: isGhost ? 'none' : undefined,
      // }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('switchcase')}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Switch</span>
        </div>
        {isGhost && (
          <button
            onClick={acceptSuggestion}
            className="p-1 hover:bg-white/20 rounded-full"
            title="Accept suggestion"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* main input pin row */}
      <div className="px-3 py-2 flex items-center gap-2 relative">
        <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        <span className="text-sm text-dominofy-light-text dark:text-dominofy-dark-text">Input</span>
      </div>

      {/* cases list */}
      <div className="flex flex-col gap-2">
        {cases.map(row => {
          const pinId = row.id === 'default' ? 'value_in' : `value_in_${row.id}`;
          const connected = edges.some(
            edge => edge.target === id && edge.targetHandle === pinId
          );

          return (
            <div key={row.id} className="flex items-center gap-2 relative px-3">
              {row.id !== 'default' && (
                <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline />
              )}

              <input
                type="text"
                value={row.value}
                placeholder={
                  connected
                    ? 'Connected'
                    : row.id === 'default'
                    ? 'Default'
                    : `Case ${row.id}`
                }
                readOnly={row.id === 'default' || connected}
                disabled={row.id === 'default' || connected}
                onChange={e => handleInputChange(row.id, e.target.value)}
                className="flex-1 px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
              />

              <DominoPin
                id={row.id === 'default' ? 'exec_out' : `exec_out_${row.id}`}
                pinType={PinType.EXEC_OUT}
                inline
              />

              {row.id !== 'default' && (
                <button
                  onClick={() => removeInput(row.id as number)}
                  className="p-1 bg-red-500 text-white rounded ml-1"
                >
                  <Trash size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* add case */}
      <div className="px-3 py-2">
        <button
          onClick={addInput}
          className="px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Add Case
        </button>
      </div>

    </div>
  );
}
