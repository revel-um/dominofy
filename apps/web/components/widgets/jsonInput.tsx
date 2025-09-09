import React, { useState, useEffect, useRef } from 'react';
import classNames from 'classnames';

type KVEntry = { key: string; value: string };

export function JsonInput({
  value = {},
  onChange,
}: {
  value?: Record<string, any>;
  onChange: (val: Record<string, any>) => void;
}) {
  const [mode, setMode] = useState<'json' | 'kv'>('json');
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [isValid, setIsValid] = useState(true);
  const [entries, setEntries] = useState<KVEntry[]>([]);
  const ignorePropUpdate = useRef(false);

  // Sync JSON textarea when `value` changes, but only in JSON mode
  useEffect(() => {
    if (mode !== 'json' || ignorePropUpdate.current) {
      ignorePropUpdate.current = false;
      return;
    }
    try {
      const newText = JSON.stringify(value, null, 2);
      if (newText !== text) {
        setText(newText);
      }
      setIsValid(true);
    } catch {
      // if value isn’t serializable
    }
  }, [value, mode]);

  // When switching into KV mode, derive entries from the current `value` prop
  useEffect(() => {
    if (mode === 'kv') {
      const newEntries: KVEntry[] = Object.entries(value).map(
        ([k, v]) => ({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) })
      );
      // always add an empty row for convenience
      newEntries.push({ key: '', value: '' });
      setEntries(newEntries);
    }
  }, [mode, value]);

  // Handle changes in the raw JSON textarea
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const input = e.target.value;
    setText(input);
    try {
      const parsed = JSON.parse(input);
      setIsValid(true);
      ignorePropUpdate.current = true;
      onChange(parsed);
    } catch {
      setIsValid(false);
    }
  };

  // Handle a change in one of the KV rows
  const handleEntryChange = (idx: number, field: 'key' | 'value', val: string) => {
    const newEntries = entries.map((ent, i) =>
      i === idx ? { ...ent, [field]: val } : ent
    );
    // if last row has data, append a fresh empty row
    const last = newEntries[newEntries.length - 1];
    if ((last.key || last.value) && !(last.key === '' && last.value === '')) {
      newEntries.push({ key: '', value: '' });
    }
    // filter out fully blank rows and build object
    const obj: Record<string, any> = {};
    newEntries.forEach(({ key, value }) => {
      if (key.trim()) {
        // try parsing value as JSON, else keep as string
        try {
          obj[key] = JSON.parse(value);
        } catch {
          obj[key] = value;
        }
      }
    });
    setEntries(newEntries);
    onChange(obj);
  };

  return (
    <div>
      {/* Mode Toggle */}
      <div className="flex space-x-2 mb-2">
        <button
          onClick={() => setMode('json')}
          className={classNames(
            'px-3 py-1 rounded',
            mode === 'json'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          )}
        >
          Raw JSON
        </button>
        <button
          onClick={() => setMode('kv')}
          className={classNames(
            'px-3 py-1 rounded',
            mode === 'kv'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'
          )}
        >
          Key-Value
        </button>
      </div>

      {mode === 'json' ? (
        // Raw JSON textarea
        <textarea
          value={text}
          onChange={handleJsonChange}
          spellCheck={false}
          className={classNames(
            'w-full rounded p-2 font-mono text-sm transition-all duration-150 text-black',
            'focus:outline-none focus:ring-2',
            isValid
              ? 'border border-gray-300 focus:ring-blue-500'
              : 'border border-red-500 focus:ring-red-500 bg-red-100'
          )}
          rows={10}
        />
      ) : (
        // Key-Value editor
        <div className="space-y-2">
          {entries.map((ent, idx) => (
            <div key={idx} className="flex space-x-2">
              <input
                type="text"
                placeholder="key"
                value={ent.key}
                onChange={(e) => handleEntryChange(idx, 'key', e.target.value)}
                className="flex-1 rounded border border-gray-300 p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="value"
                value={ent.value}
                onChange={(e) => handleEntryChange(idx, 'value', e.target.value)}
                className="flex-1 rounded border border-gray-300 p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
