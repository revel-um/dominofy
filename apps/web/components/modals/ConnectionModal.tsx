import React from 'react';
import { FiX } from 'react-icons/fi';

export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

interface ConnectionModalProps {
  open: boolean;
  config: ConnectionConfig;
  onChange: (cfg: ConnectionConfig) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function ConnectionModal({
  open,
  config,
  onChange,
  onSave,
  onClose,
}: ConnectionModalProps) {
  if (!open) return null;

  const handleFieldChange = (
    field: keyof ConnectionConfig,
    value: string | boolean
  ) => {
    const updated: ConnectionConfig = {
      ...config,
      [field]:
        field === 'port'
          ? Number(value)
          : field === 'ssl'
          ? Boolean(value)
          : value,
    };
    onChange(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black opacity-40 dark:bg-gray-900 dark:opacity-60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-96 z-60">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Connection Settings
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <FiX className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Host
            </label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => handleFieldChange('host', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Port
            </label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => handleFieldChange('port', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Database
            </label>
            <input
              type="text"
              value={config.database}
              onChange={(e) => handleFieldChange('database', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              User
            </label>
            <input
              type="text"
              value={config.user}
              onChange={(e) => handleFieldChange('user', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              type="password"
              value={config.password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={config.ssl}
              onChange={(e) => handleFieldChange('ssl', e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Use SSL
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-3 space-x-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}