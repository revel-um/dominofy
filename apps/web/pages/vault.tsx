import React, { useCallback, useEffect, useRef, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import {
  FiChevronRight,
  FiDatabase,
  FiKey,
  FiLink2,
  FiMoreVertical,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiX,
} from 'react-icons/fi';
import { VaultsApi, CreateVaultPayload } from '@/apis/vault.apis';
import { config } from '@/config/config';

interface VaultItem {
  id: string;
  name: string;
  type: string;
  connection: Record<string, unknown>;
}

interface VaultTypeOption {
  type: string;
  label: string;
  installUrlPath?: string;
}

function formatTypeLabel(value: string, vaultTypes: VaultTypeOption[]) {
  const option = vaultTypes.find((t) => t.type === value);
  if (option?.label) return option.label;
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function VaultMetric({
  label,
  value,
  meta,
  icon,
  accentClassName,
}: {
  label: string;
  value: string | number;
  meta: string;
  icon: React.ReactNode;
  accentClassName: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {meta}
          </p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accentClassName}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function VaultManager() {
  const router = useRouter();
  const [vaults, setVaults] = useState<VaultItem[]>([]);
  const [vaultTypes, setVaultTypes] = useState<VaultTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('postgres');
  const [connectionJson, setConnectionJson] = useState('{}');

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const typeMenuRef = useRef<HTMLDivElement | null>(null);
  const newBtnRef = useRef<HTMLButtonElement | null>(null);

  const loadVaultData = useCallback(async () => {
    try {
      const [vaultRes, typesRes] = await Promise.all([
        VaultsApi.getVaults(token, router),
        VaultsApi.getVaultTypes(token, router),
      ]);
      if (vaultRes?.ok) {
        const { items } = await vaultRes.json() as { items: VaultItem[] };
        setVaults(items);
      }
      if (typesRes?.ok) {
        const types = await typesRes.json() as VaultTypeOption[];
        const normalized = Array.isArray(types) ? types : [];
        setVaultTypes(normalized);
        if (normalized.length && !normalized.find((t) => t.type === type)) {
          setType(normalized[0].type);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router, token, type]);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        showTypeMenu &&
        typeMenuRef.current &&
        newBtnRef.current &&
        !typeMenuRef.current.contains(target) &&
        !newBtnRef.current.contains(target)
      ) {
        setShowTypeMenu(false);
      }

      if (activeMenuId) {
        const trigger = document.getElementById(`vault-actions-${activeMenuId}`);
        const menu = document.getElementById(`vault-menu-${activeMenuId}`);
        if (trigger && menu && !trigger.contains(target) && !menu.contains(target)) {
          setActiveMenuId(null);
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTypeMenu, activeMenuId]);

  const refreshVaults = async () => {
    setLoading(true);
    try {
      const res = await VaultsApi.getVaults(token, router);
      if (res?.ok) {
        const { items } = await res.json() as { items: VaultItem[] };
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
    setType(vaultTypes[0]?.type || 'postgres');
    setConnectionJson('{}');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload: CreateVaultPayload = {
        name,
        type,
        connection: JSON.parse(connectionJson) as Record<string, unknown>,
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

  const handleOAuthConnect = async () => {
    const selectedType = vaultTypes.find((t) => t.type === type);
    if (!selectedType?.installUrlPath) return;
    try {
      const res = await fetch(`${config.backendBaseUrl}${selectedType.installUrlPath}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { url } = await res.json() as { url?: string };
      if (url) window.location.href = url;
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

  const selectTypeAndOpen = (selected: string) => {
    setType(selected);
    setShowTypeMenu(false);
    setShowForm(true);
  };

  const oauthReadyCount = vaultTypes.filter((item) => item.installUrlPath).length;
  const uniqueTypeCount = new Set(vaults.map((vault) => vault.type)).size;

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] px-4 py-4 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)] sm:px-5 sm:py-5">
      <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/65 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,_rgba(56,189,248,0.18),_transparent_26%),radial-gradient(circle_at_88%_12%,_rgba(16,185,129,0.16),_transparent_24%)]" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
              <FiShield className="h-3.5 w-3.5" />
              Vault management
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Secure every connection point
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600 dark:text-slate-300">
              Organize shared credentials, review active integrations, and add new data sources without losing visibility into your connection surface.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={refreshVaults}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/85 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-950/60"
            >
              <FiRefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <div className="relative">
              <button
                ref={newBtnRef}
                onClick={() => setShowTypeMenu((prev) => !prev)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                <FiPlus className="h-4 w-4" />
                New Connection
              </button>

              {showTypeMenu && (
                <div
                  ref={typeMenuRef}
                  className="absolute right-0 z-20 mt-3 w-56 rounded-3xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95"
                >
                  {vaultTypes.length ? (
                    vaultTypes.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => selectTypeAndOpen(opt.type)}
                        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                      >
                        <span>{opt.label}</span>
                        <FiChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No connection types available</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.8fr),minmax(280px,0.8fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <VaultMetric
            label="Connections"
            value={vaults.length}
            meta="Stored and reusable vault entries."
            icon={<FiDatabase className="h-5 w-5 text-sky-700 dark:text-sky-100" />}
            accentClassName="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100"
          />
          <VaultMetric
            label="Connection Types"
            value={uniqueTypeCount}
            meta="Distinct service types already configured."
            icon={<FiLink2 className="h-5 w-5 text-violet-700 dark:text-violet-100" />}
            accentClassName="bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-100"
          />
          <VaultMetric
            label="OAuth Ready"
            value={oauthReadyCount}
            meta="Providers available for one-click connect."
            icon={<FiKey className="h-5 w-5 text-emerald-700 dark:text-emerald-100" />}
            accentClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
          />
        </div>

        <div className="rounded-[28px] border border-slate-200/70 bg-[linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.9))] p-4 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] dark:border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">
            Access posture
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {vaultTypes.length} provider{vaultTypes.length === 1 ? '' : 's'} available
          </h2>
          <p className="mt-3 text-sm leading-5 text-slate-300">
            Add provider-backed connections for OAuth flows or create JSON-based credentials for direct service access.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Primary type</p>
              <p className="mt-2 text-sm font-medium text-white">
                {vaults[0] ? formatTypeLabel(vaults[0].type, vaultTypes) : 'No connections yet'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">JSON payloads</p>
              <p className="mt-2 text-sm font-medium text-white">
                {vaults.length > 0 ? 'Managed centrally' : 'Awaiting setup'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_26px_70px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/70 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Connection inventory
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              Review configured credentials and integrations
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="mx-auto flex min-h-[260px] w-full max-w-lg items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-slate-300">
            Loading connections...
          </div>
        ) : vaults.length ? (
          <div className="min-h-0 flex-1 overflow-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vaults.map((vault) => {
              const connectionKeys = Object.keys(vault.connection || {});
              return (
                <article
                  key={vault.id}
                  className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/45"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-100">
                        <FiDatabase className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">
                        {vault.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {formatTypeLabel(vault.type, vaultTypes)}
                      </p>
                    </div>

                    <div className="relative">
                      <button
                        id={`vault-actions-${vault.id}`}
                        onClick={() => setActiveMenuId((current) => (current === vault.id ? null : vault.id))}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-white"
                      >
                        <FiMoreVertical className="h-4 w-4" />
                      </button>

                      {activeMenuId === vault.id && (
                        <div
                          id={`vault-menu-${vault.id}`}
                          className="absolute right-0 z-20 mt-2 w-36 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/95"
                        >
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              handleDelete(vault.id);
                            }}
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Fields</p>
                      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">{connectionKeys.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Source</p>
                      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                        {vaultTypes.find((item) => item.type === vault.type)?.installUrlPath ? 'OAuth supported' : 'Manual JSON'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Connection keys</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {connectionKeys.length ? (
                        connectionKeys.slice(0, 5).map((key) => (
                          <span
                            key={key}
                            className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                          >
                            {key}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400">No fields stored</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-[320px] w-full max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-200">
              <FiDatabase className="h-6 w-6" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-950 dark:text-white">
              No connections configured
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              Add your first vault connection to centralize credentials for databases, SaaS providers, and external services.
            </p>
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 p-4 backdrop-blur-sm" onClick={resetForm}>
          <div className="flex min-h-full items-center justify-center">
            <div
              className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Create connection
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                    New {formatTypeLabel(type, vaultTypes)} vault
                  </h2>
                </div>
                <button
                  onClick={resetForm}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-white"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Name
                  </label>
                  <input
                    type="text"
                    className="mt-2 block min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:focus:border-sky-400/60 dark:focus:ring-sky-400/10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Type
                  </label>
                  <input
                    readOnly
                    className="mt-2 block min-h-[44px] w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
                    value={formatTypeLabel(type, vaultTypes)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Connection JSON
                  </label>
                  <textarea
                    className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950"
                    rows={6}
                    value={connectionJson}
                    onChange={(e) => setConnectionJson(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    className="min-h-[44px] rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                  {vaultTypes.find((t) => t.type === type)?.installUrlPath ? (
                    <button
                      type="button"
                      className="min-h-[44px] rounded-2xl bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700"
                      onClick={handleOAuthConnect}
                    >
                      Connect via OAuth
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                  >
                    Create connection
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
