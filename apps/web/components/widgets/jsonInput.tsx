import React, { useState, useEffect, useRef } from 'react';
import classNames from 'classnames';

export function JsonInput({
  value = {},
  onChange,
}: {
  value?: any;
  onChange: (val: any) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [isValid, setIsValid] = useState(true);
  const ignorePropUpdate = useRef(false);

  useEffect(() => {
    if (ignorePropUpdate.current) {
      ignorePropUpdate.current = false;
      return;
    }
    try {
      const newText = JSON.stringify(value, null, 2);
      if (newText !== text) {
        setText(newText);
      }
    } catch {
      // do nothing if value is not serializable
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  return (
    <textarea
      value={text}
      onChange={handleChange}
      spellCheck={false}
      className={classNames(
        'w-full rounded p-2 font-mono text-sm transition-all duration-150 text-black',
        'focus:outline-none focus:ring-2',
        isValid
          ? 'border border-gray-300 focus:ring-blue-500'
          : 'border border-red-500 focus:ring-red-500 bg-red-100 dark:bg-red-900'
      )}
      rows={10}
    />
  );
}
