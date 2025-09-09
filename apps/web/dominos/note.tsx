import { NodeProps } from 'reactflow';
import React, { useEffect, useRef, useState } from 'react';

type NoteData = {
  text?: string;
  color?: string;
  workflowId?: string;
  details?: { fields: [] }, // 👈
};

export default function NoteDomino({ id, data, selected, isConnectable }: NodeProps<NoteData>) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState<string>(data?.text ?? 'Double-click to edit');
  const [color, setColor] = useState<string>(data?.color ?? '#FFF9C4'); // soft yellow
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
    //   textareaRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    // If you want to persist into parent state, wire a setNodes updater through data
    // For now we mutate the local data object (ReactFlow will keep it in memory)
    if (data) {
      data.text = text;
      data.color = color;
      // keep a stable details object
      if (!data.details) data.details = { fields: []  };
      if (!Array.isArray(data.details.fields)) data.details.fields = [];
    }
  };

  return (
    <div
      className={`rounded-2xl shadow-md border w-[220px] ${selected ? 'ring-2 ring-blue-400' : ''}`}
      style={{ background: color }}
      onDoubleClick={() => setEditing(true)}
    >
      <div className="px-3 py-2 flex items-center justify-between gap-4">
        <span className="text-xs uppercase tracking-wide text-gray-700">Note</span>
        <input
          type="color"
          aria-label="Note color"
          className="w-5 h-5 rounded border cursor-pointer"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="px-3 pb-6">
        {!editing ? (
          <div
            className="text-sm text-gray-900 whitespace-pre-wrap min-h-[64px] cursor-text"
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          >
            {text}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className="w-full text-sm p-2 rounded border border-gray-300 focus:outline-none focus:ring"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
                e.currentTarget.blur();
              }
            }}
          />
        )}
      </div>
    </div>
  );
}