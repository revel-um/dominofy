import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useRouter } from 'next/router';
import { FiPlus, FiMoreVertical } from 'react-icons/fi';
import { VaultsApi, CreateVaultPayload } from '@/apis/vault.apis';

interface VaultItem {
  id: string;
  name: string;
  type: string;
  connection: Record<string, any>;
}

export default function VaultManager() {
  const router = useRouter();
  const [vaults, setVaults] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'postgres' | 'mongodb' | 'aws' | 'email'>('postgres');
  const [connectionJson, setConnectionJson] = useState('{}');

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  /* ───────────────────────── refs for outside-click detection ───────────────────────── */
  const typeMenuRef = useRef<HTMLDivElement | null>(null);
  const newBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await VaultsApi.getVaults(token, router);
        if (res?.ok) {
          const { items } = await res.json();
          setVaults(items);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ───────────────────────── close type-menu when clicking outside ───────────────────────── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        showTypeMenu &&
        typeMenuRef.current &&
        newBtnRef.current &&
        !typeMenuRef.current.contains(e.target as Node) &&
        !newBtnRef.current.contains(e.target as Node)
      ) {
        setShowTypeMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTypeMenu]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload: CreateVaultPayload = {
        name,
        type,
        connection: JSON.parse(connectionJson),
      };
      const res = await VaultsApi.createVault(payload, token, router);
      if (res?.ok) {
        resetForm();
        refreshVaults();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    try {
      const res = await VaultsApi.deleteVault(id, token, router);
      if (res?.ok) refreshVaults();
    } catch (err) {
      console.error(err);
    }
  };

  const refreshVaults = async () => {
    setLoading(true);
    try {
      const res = await VaultsApi.getVaults(token, router);
      if (res?.ok) {
        const { items } = await res.json();
        setVaults(items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setShowTypeMenu(false);
    setName('');
    setType('postgres');
    setConnectionJson('{}');
  };

  const selectTypeAndOpen = (selected: 'postgres' | 'mongodb' | 'aws' | 'email') => {
    setType(selected);
    setShowTypeMenu(false);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Vault Connections
          </h1>

          <div className="relative inline-block">
            <button
              ref={newBtnRef}
              onClick={() => setShowTypeMenu((prev) => !prev)}
              className="inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
            >
              <FiPlus className="mr-2 h-5 w-5" />
              New Connection
            </button>

            {showTypeMenu && (
              <div
                ref={typeMenuRef}
                className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-20"
              >
                {(['postgres', 'mongodb', 'aws', 'email'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => selectTypeAndOpen(opt)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-gray-500 dark:text-gray-400">
              Loading connections…
            </span>
          </div>
        ) : vaults.length ? (
          vaults.map((v) => (
            <div
              key={v.id}
              className="flex justify-between items-center p-4 mb-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className='ml-4'>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {v.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {v.type}
                </p>
              </div>

              {/* Icon + dropdown wrapper */}
              <div className="relative inline-block group mr-2">
                <button className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none">
                  <FiMoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </button>

                {/* Menu flush against icon: stays visible when hovered */}
                <div className="hidden group-hover:block absolute right-0 top-full w-32 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-10">
                  <button
                    onClick={() => console.log('Edit', v.id)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">
              No connections found
            </p>
          </div>
        )}
      </main>

      {/* Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center"
          onClick={resetForm}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                New {type.charAt(0).toUpperCase() + type.slice(1)} Connection
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <input
                  type="text"
                  className="mt-1 block w-full border rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Type
                </label>
                <input
                  readOnly
                  className="mt-1 block w-full border rounded p-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-not-allowed"
                  value={type}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Connection JSON
                </label>
                <textarea
                  className="mt-1 block w-full border rounded p-2 font-mono bg-white dark:bg-gray-700 text-gray-100"
                  rows={4}
                  value={connectionJson}
                  onChange={(e) => setConnectionJson(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                  onClick={resetForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
