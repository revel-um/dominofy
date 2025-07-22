import React, { useEffect, useState } from 'react';
import { DominoField } from '../../types/dominoFieldTypes';

type Props = {
  field: DominoField;
  onChange: (parsed: object | null, raw: string) => void;
};

export default function JsonEditor({ field, onChange }: Props) {
  const [raw, setRaw] = useState(() =>
    typeof field.value === 'object' ? JSON.stringify(field.value, null, 2) : ''
  );
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setRaw(typeof field.value === 'object' ? JSON.stringify(field.value, null, 2) : '');
  }, [field.value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setRaw(value);

    try {
      const parsed = JSON.parse(value);
      setIsValid(true);
      onChange(parsed, value);
    } catch {
      setIsValid(false);
      onChange(null, value);
    }
  };

  return (
    <textarea
      rows={3}
      value={raw}
      onChange={handleChange}
      className={`flex-1 px-2 py-1 text-sm border rounded font-mono
        ${isValid ? 'border-gray-300' : 'border-red-500'}
        bg-dominofy-light-surface dark:bg-dominofy-dark-surface
        text-dominofy-light-text dark:text-dominofy-dark-text`}
      placeholder="{}"
    />
  );
}
