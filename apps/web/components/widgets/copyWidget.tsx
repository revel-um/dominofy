import React, { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';

export function CopyWidget({
  value,
}: {
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value.trim()) {
      alert('Function name is empty. Please provide a valid one.');
      return;
    }

    navigator.clipboard.writeText(value);
    setCopied(true);

    // Reset icon after 1.5 seconds
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 border p-2 rounded bg-dominofy-light-surface">
      <div className="flex-1 text-sm text-dominofy-light-text truncate">
        {value}
      </div>
      {copied ? (
        <FiCheck className="text-gray-600 flex-shrink-0" title="Copied!" />
      ) : (
        <FiCopy
          onClick={handleCopy}
          className="cursor-pointer text-gray-600 hover:text-black flex-shrink-0"
          title="Copy"
        />
      )}
    </div>
  );
}
