import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeProps } from 'reactflow';
import { CalendarDays, CalendarPlus2, Radio, UserRoundSearch } from 'lucide-react';
import { useRouter, NextRouter } from 'next/router';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import SearchableSelect from '@/components/searchableDropdown';
import { CalendarApi, CalendarConnection, CalendarListItem } from '@/apis/calendar.apis';
import dominoCatalog from './dominos';

type TriggerNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    setFieldValue?: (heading: string, newValue: unknown) => void;
  };
};

function getNodeType(id: string, explicitType?: string) {
  return explicitType || id.replace(/-\d+$/, '');
}

export default function GoogleCalendarTriggerDomino(props: NodeProps) {
  const { data, id, selected } = props;
  const nodeType = getNodeType(id, (props as any).type);
  const isCreatedTrigger = nodeType === 'googleCalendarEventCreated';
  const catalogMeta = dominoCatalog.find(entry => entry.id === nodeType);
  const accentColor = catalogMeta?.badgeStyle?.background
    ? String(catalogMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
    : isCreatedTrigger
      ? '#34A853'
      : '#FBBC05';
  const Icon = isCreatedTrigger ? CalendarPlus2 : CalendarDays;

  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isPreviewMode = Boolean((data as any).previewMode);
  const router: NextRouter = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const bootstrappedRef = useRef(false);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find((field) => field.heading === heading),
    [data.details],
  );

  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [calendars, setCalendars] = useState<CalendarListItem[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  const vaultId = String(getField('vaultId')?.value ?? '');
  const calendarId = String(getField('calendarId')?.value ?? 'primary');

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;

    const setFieldValue = (heading: string, newValue: unknown) => {
      data.setNodes?.((nodes: TriggerNodeRecord[]) =>
        nodes.map((node: TriggerNodeRecord) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    ...node.data.details,
                    fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                      field.heading === heading ? { ...field, value: newValue } : field,
                    ),
                  },
                },
              }
            : node,
        ),
      );
    };

    const initialFields: DominoField[] = [
      { type: 'dropdown', heading: 'vaultId', value: '', options: [], required: true, shouldRender: false },
      { type: 'dropdown', heading: 'calendarId', value: 'primary', options: [], required: true, shouldRender: false },
    ];

    data.setNodes((prev: TriggerNodeRecord[]) =>
      prev.map((node: TriggerNodeRecord) => {
        if (node.id !== id) return node;
        const details = node.data.details as DominoNodeData | undefined;
        const fields = details?.fields ?? [];
        const mergedFields = initialFields.map((initialField) => {
          const existingField = fields.find((field) => field.heading === initialField.heading);
          return existingField ? { ...initialField, ...existingField } : initialField;
        });

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              type: isCreatedTrigger ? 'Calendar Event Created' : 'Calendar Event Updated',
              description: catalogMeta?.description,
              isTrigger: true,
              ...(details ?? {}),
              fields: mergedFields,
            } as DominoNodeData,
            exportFields: node.data.exportFields ?? ['vaultId', 'calendarId'],
            setFieldValue: node.data.setFieldValue ?? setFieldValue,
          },
        };
      }),
    );

    bootstrappedRef.current = true;
  }, [catalogMeta?.description, data, id, isCreatedTrigger]);

  const setFieldValue = useCallback(
    (heading: string, value: unknown) => {
      clearValidationForDominoId?.(id);
      data.setFieldValue?.(heading, value);
      if (!data.setFieldValue && data.setNodes) {
        data.setNodes((nodes: TriggerNodeRecord[]) =>
          nodes.map((node: TriggerNodeRecord) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    details: {
                      ...node.data.details,
                      fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                        field.heading === heading ? { ...field, value } : field,
                      ),
                    },
                  },
                }
              : node,
          ),
        );
      }
    },
    [clearValidationForDominoId, data, id],
  );

  useEffect(() => {
    if (isPreviewMode) {
      setLoadingConns(false);
      setConnections([]);
      return;
    }

    let mounted = true;
    (async () => {
      setLoadingConns(true);
      try {
        const list = await CalendarApi.getConnections(token, router);
        if (mounted) setConnections(Array.isArray(list) ? list : []);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isPreviewMode, token, router]);

  useEffect(() => {
    if (isPreviewMode || !vaultId) {
      setCalendars([]);
      setLoadingCalendars(false);
      return;
    }

    let mounted = true;
    (async () => {
      setLoadingCalendars(true);
      try {
        const list = await CalendarApi.getCalendars(token, router, vaultId);
        if (mounted) setCalendars(Array.isArray(list) ? list : []);
      } finally {
        if (mounted) setLoadingCalendars(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isPreviewMode, vaultId, token, router]);

  const startOAuth = async () => {
    const url = await CalendarApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === vaultId),
    [connections, vaultId],
  );

  const renderDecoratedHeading = (label: string, icon: React.ComponentType<{ className?: string }>) => {
    const HeadingIcon = icon;
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
          <HeadingIcon className="h-3.5 w-3.5" />
          {label}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
      } hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{ borderColor: accentColor, backgroundColor: `${accentColor}22` }}
          >
            <Icon className="h-4 w-4" style={{ color: accentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              {isCreatedTrigger ? 'Calendar Event Created' : 'Calendar Event Updated'}
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Trigger
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          {renderDecoratedHeading('Trigger Mode', Radio)}
          <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
            {isCreatedTrigger ? 'Runs on newly created events' : 'Runs when an existing event changes'}
          </div>
        </div>

        <button
          type="button"
          className="w-full rounded-lg border border-sky-500/30 bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={startOAuth}
          disabled={loadingConns}
        >
          {connections.length === 0 ? 'Connect Google Calendar' : 'Add Google Calendar connection'}
        </button>

        <div className="space-y-2">
          {renderDecoratedHeading('Google Account', UserRoundSearch)}
          <SearchableSelect
            value={vaultId}
            onChange={(value) => {
              setFieldValue('vaultId', value);
              setFieldValue('calendarId', 'primary');
            }}
            placeholder={loadingConns ? 'Loading connections' : 'Select account'}
            options={connections.map((connection) => ({
              label: connection.email || connection.name,
              value: connection.id,
            }))}
          />
        </div>

        <div className="space-y-2">
          {renderDecoratedHeading('Calendar', CalendarDays)}
          <SearchableSelect
            value={calendarId}
            onChange={(value) => setFieldValue('calendarId', value)}
            placeholder={loadingCalendars ? 'Loading calendars' : 'Select calendar'}
            options={calendars.map((calendar) => ({
              label: calendar.primary ? `${calendar.summary} (Primary)` : calendar.summary,
              value: calendar.id,
            }))}
          />
        </div>

        <div className="rounded-lg border border-dashed border-slate-300/80 px-3 py-2 text-xs text-foreground/60 dark:border-slate-600 dark:text-slate-300">
          {selectedConnection
            ? `Polling ${selectedConnection.email || selectedConnection.name} for calendar changes.`
            : 'Choose an account and calendar to activate polling.'}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Icon className="h-3.5 w-3.5" />
              Trigger Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Event payload
            </span>
          </div>

          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  {isCreatedTrigger ? 'New calendar event details' : 'Updated calendar event details'}
                </div>
              </div>
            </div>
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline offset={-17} />
          </div>
        </div>
      </div>
    </div>
  );
}
