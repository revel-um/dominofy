import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeProps, useEdges } from 'reactflow';
import { CalendarPlus2, CalendarSync, CalendarX2, Link2 } from 'lucide-react';
import { useRouter, NextRouter } from 'next/router';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import DominoDropdown from '../components/shared/dominoDropdown';
import SearchableSelect from '@/components/searchableDropdown';
import { CalendarApi, CalendarConnection, CalendarListItem } from '@/apis/calendar.apis';
import dominoCatalog from './dominos';

type CalendarActionNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    setFieldValue?: (heading: string, newValue: unknown) => void;
  };
};

const TIMEZONE_OPTIONS = [
  { label: 'Asia/Kolkata', value: 'Asia/Kolkata' },
  { label: 'UTC', value: 'UTC' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'America/Denver', value: 'America/Denver' },
  { label: 'America/Chicago', value: 'America/Chicago' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Toronto', value: 'America/Toronto' },
  { label: 'America/Sao_Paulo', value: 'America/Sao_Paulo' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Paris', value: 'Europe/Paris' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Europe/Amsterdam', value: 'Europe/Amsterdam' },
  { label: 'Europe/Dublin', value: 'Europe/Dublin' },
  { label: 'Asia/Dubai', value: 'Asia/Dubai' },
  { label: 'Asia/Singapore', value: 'Asia/Singapore' },
  { label: 'Asia/Bangkok', value: 'Asia/Bangkok' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'Asia/Seoul', value: 'Asia/Seoul' },
  { label: 'Australia/Sydney', value: 'Australia/Sydney' },
  { label: 'Pacific/Auckland', value: 'Pacific/Auckland' },
];

const EMAIL_NOTIFICATION_OPTIONS = [
  { label: 'Send to all guests', value: 'all' },
  { label: 'Send to external guests', value: 'externalOnly' },
  { label: 'Do not send email', value: 'none' },
];

const MEET_LINK_OPTIONS = [
  { label: 'Add Google Meet link', value: 'true' },
  { label: 'Do not add Meet link', value: 'false' },
];

const VALUE_PINS = {
  vaultId: 'value_in',
  calendarId: 'value_in_1',
  eventId: 'value_in_2',
  summary: 'value_in_3',
  description: 'value_in_4',
  location: 'value_in_5',
  start: 'value_in_6',
  end: 'value_in_7',
  attendees: 'value_in_8',
  timezone: 'value_in_9',
  sendUpdates: 'value_in_10',
  createMeetLink: 'value_in_11',
} as const;

const TYPE_META: Record<string, { title: string; subtitle: string; icon: any; exportFields: string[] }> = {
  googleCalendarCreate: {
    title: 'Calendar Create Event',
    subtitle: 'Action',
    icon: CalendarPlus2,
    exportFields: ['vaultId', 'calendarId', 'summary', 'description', 'location', 'start', 'end', 'attendees', 'timezone', 'sendUpdates', 'createMeetLink'],
  },
  googleCalendarUpdate: {
    title: 'Calendar Update Event',
    subtitle: 'Action',
    icon: CalendarSync,
    exportFields: ['vaultId', 'calendarId', 'eventId', 'summary', 'description', 'location', 'start', 'end', 'attendees', 'timezone', 'sendUpdates'],
  },
  googleCalendarDelete: {
    title: 'Calendar Delete Event',
    subtitle: 'Action',
    icon: CalendarX2,
    exportFields: ['vaultId', 'calendarId', 'eventId'],
  },
};

const OUTPUT_LABELS: Record<string, string> = {
  googleCalendarCreate: 'Created event payload',
  googleCalendarUpdate: 'Updated event payload',
  googleCalendarDelete: 'Delete result payload',
};

function getNodeType(id: string, explicitType?: string) {
  return explicitType || id.replace(/-\d+$/, '');
}

function buildInitialFields(nodeType: string): DominoField[] {
  const base: DominoField[] = [
    { type: 'dropdown', heading: 'vaultId', value: '', options: [], required: true, shouldRender: false, inPinId: VALUE_PINS.vaultId },
    { type: 'dropdown', heading: 'calendarId', value: 'primary', options: [], required: true, shouldRender: false, inPinId: VALUE_PINS.calendarId },
  ];

  if (nodeType === 'googleCalendarDelete') {
    return [
      ...base,
      { type: 'textInput', heading: 'eventId', value: '', required: true, inPinId: VALUE_PINS.eventId },
    ];
  }

  const actionFields: DominoField[] = [
    ...(nodeType === 'googleCalendarUpdate'
      ? [{ type: 'textInput', heading: 'eventId', value: '', required: true, inPinId: VALUE_PINS.eventId } as DominoField]
      : []),
    { type: 'textInput', heading: 'summary', value: '', required: nodeType === 'googleCalendarCreate', inPinId: VALUE_PINS.summary },
    { type: 'textArea', heading: 'description', value: '', inPinId: VALUE_PINS.description },
    { type: 'textInput', heading: 'location', value: '', inPinId: VALUE_PINS.location },
    { type: 'textInput', heading: 'start', value: '', required: nodeType === 'googleCalendarCreate', inPinId: VALUE_PINS.start },
    { type: 'textInput', heading: 'end', value: '', required: nodeType === 'googleCalendarCreate', inPinId: VALUE_PINS.end },
    { type: 'textInput', heading: 'attendees', value: '', inPinId: VALUE_PINS.attendees },
    {
      type: 'dropdown',
      heading: 'timezone',
      value: 'Asia/Kolkata',
      inPinId: VALUE_PINS.timezone,
      options: TIMEZONE_OPTIONS,
    },
    {
      type: 'dropdown',
      heading: 'sendUpdates',
      value: 'all',
      inPinId: VALUE_PINS.sendUpdates,
      options: EMAIL_NOTIFICATION_OPTIONS,
    },
    ...(nodeType === 'googleCalendarCreate'
      ? [
          {
            type: 'dropdown',
            heading: 'createMeetLink',
            value: 'false',
            inPinId: VALUE_PINS.createMeetLink,
            options: MEET_LINK_OPTIONS,
          } as DominoField,
        ]
      : []),
  ];

  return [...base, ...actionFields];
}

export default function GoogleCalendarActionDomino(props: NodeProps) {
  const { data, id, selected } = props;
  const nodeType = getNodeType(id, (props as any).type);
  const meta = TYPE_META[nodeType] ?? TYPE_META.googleCalendarCreate;
  const catalogMeta = dominoCatalog.find(entry => entry.id === nodeType);
  const accentColor = catalogMeta?.badgeStyle?.background
    ? String(catalogMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
    : '#4285F4';
  const Icon = meta.icon;

  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isPreviewMode = Boolean((data as any).previewMode);
  const router: NextRouter = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const edges = useEdges();
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
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const vaultId = String(getField('vaultId')?.value ?? '');
  const calendarId = String(getField('calendarId')?.value ?? 'primary');

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const fieldName of ['eventId', 'summary', 'description', 'location', 'start', 'end', 'attendees', 'timezone', 'sendUpdates', 'createMeetLink']) {
      const nextValue = getField(fieldName)?.value;
      nextDrafts[fieldName] = typeof nextValue === 'string' ? nextValue : String(nextValue ?? '');
    }

    setDraftValues((prev) => {
      const same = Object.keys(nextDrafts).every((key) => prev[key] === nextDrafts[key]);
      return same ? prev : nextDrafts;
    });
  }, [getField]);

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;

    const setFieldValue = (heading: string, newValue: unknown) => {
      data.setNodes?.((nodes: CalendarActionNodeRecord[]) =>
        nodes.map((node: CalendarActionNodeRecord) =>
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

    const initialFields = buildInitialFields(nodeType);

    data.setNodes((prev: CalendarActionNodeRecord[]) =>
      prev.map((node: CalendarActionNodeRecord) => {
        if (node.id !== id) return node;
        const details = node.data.details as DominoNodeData | undefined;
        const fields = details?.fields ?? [];
        const mergedFields = initialFields.map((initialField) => {
          const existingField = fields.find((field) => field.heading === initialField.heading);
          return existingField
            ? {
                ...existingField,
                ...initialField,
                value: existingField.value,
                options: initialField.options ?? existingField.options,
              }
            : initialField;
        });

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              type: meta.title,
              description: catalogMeta?.description,
              isTrigger: false,
              ...(details ?? {}),
              fields: mergedFields,
            } as DominoNodeData,
            exportFields: node.data.exportFields ?? meta.exportFields,
            setFieldValue: node.data.setFieldValue ?? setFieldValue,
          },
        };
      }),
    );

    bootstrappedRef.current = true;
  }, [catalogMeta?.description, data, id, meta.exportFields, meta.title, nodeType]);

  const setFieldValue = useCallback(
    (heading: string, value: unknown) => {
      clearValidationForDominoId?.(id);
      data.setFieldValue?.(heading, value);
      if (!data.setFieldValue && data.setNodes) {
        data.setNodes((nodes: CalendarActionNodeRecord[]) =>
          nodes.map((node: CalendarActionNodeRecord) =>
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

  const renderTextField = (heading: string, label: string, placeholder: string, pinId?: string) => {
    const value = draftValues[heading] ?? String(getField(heading)?.value ?? '');
    const connected = pinId
      ? edges.some((edge) => edge.target === id && edge.targetHandle === pinId)
      : false;

    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
          {label}
        </label>
        <div className="relative">
          <div className="flex items-center gap-2">
            {pinId ? <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline offset={-16} /> : null}
            <input
              className="w-full rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-100"
              value={value}
              placeholder={connected ? 'Connected' : placeholder}
              onChange={(e) => {
                const nextValue = e.target.value;
                setDraftValues((prev) => ({ ...prev, [heading]: nextValue }));
                setFieldValue(heading, nextValue);
              }}
              disabled={connected}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderDropdownField = (
    heading: string,
    label: string,
    value: string,
    options: { label: string; value: string }[],
    onChange: (value: string) => void,
    placeholder: string,
    pinId?: string,
    menuWidthClassName?: string,
  ) => {
    const connected = pinId
      ? edges.some((edge) => edge.target === id && edge.targetHandle === pinId)
      : false;

    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
          {label}
        </label>
        <div className="relative">
          <div className="flex items-center gap-2">
            {pinId ? <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline offset={-16} /> : null}
            <div className="flex-1">
              <DominoDropdown
                value={value}
                onChange={onChange}
                placeholder={connected ? 'Connected' : placeholder}
                options={options}
                menuWidthClassName={menuWidthClassName}
                disabled={connected}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === vaultId),
    [connections, vaultId],
  );
  const vaultIdConnected = edges.some((edge) => edge.target === id && edge.targetHandle === VALUE_PINS.vaultId);
  const calendarIdConnected = edges.some((edge) => edge.target === id && edge.targetHandle === VALUE_PINS.calendarId);

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
      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={{ borderColor: accentColor, backgroundColor: `${accentColor}22` }}
          >
            <Icon className="h-4 w-4" style={{ color: accentColor }} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              {meta.title}
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              {meta.subtitle}
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
            Connection
          </div>
          <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
            {selectedConnection ? selectedConnection.email || selectedConnection.name : 'Connect a Google Calendar account'}
          </div>
        </div>

        <button
          type="button"
          className="w-full rounded-lg border border-blue-500/30 bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={startOAuth}
          disabled={loadingConns}
        >
          {connections.length === 0 ? 'Connect Google Calendar' : 'Add Google Calendar connection'}
        </button>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
            Google Account
          </label>
          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id={VALUE_PINS.vaultId} pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="flex-1">
                <SearchableSelect
                  value={vaultId}
                  onChange={(value) => {
                    setFieldValue('vaultId', value);
                    setFieldValue('calendarId', 'primary');
                  }}
                  placeholder={vaultIdConnected ? 'Connected' : loadingConns ? 'Loading connections' : 'Select account'}
                  options={connections.map((connection) => ({
                    label: connection.email || connection.name,
                    value: connection.id,
                  }))}
                  disabled={vaultIdConnected}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
            Calendar
          </label>
          <div className="relative">
            <div className="flex items-center gap-2">
              <DominoPin id={VALUE_PINS.calendarId} pinType={PinType.VALUE_IN} inline offset={-16} />
              <div className="flex-1">
                <SearchableSelect
                  value={calendarId}
                  onChange={(value) => setFieldValue('calendarId', value)}
                  placeholder={calendarIdConnected ? 'Connected' : loadingCalendars ? 'Loading calendars' : 'Select calendar'}
                  options={calendars.map((calendar) => ({
                    label: calendar.primary ? `${calendar.summary} (Primary)` : calendar.summary,
                    value: calendar.id,
                  }))}
                  disabled={calendarIdConnected}
                />
              </div>
            </div>
          </div>
        </div>

        {nodeType !== 'googleCalendarDelete' ? (
          renderDropdownField(
            'timezone',
            'Timezone',
            draftValues.timezone ?? String(getField('timezone')?.value ?? 'Asia/Kolkata'),
            TIMEZONE_OPTIONS,
            (value) => {
              setDraftValues((prev) => ({ ...prev, timezone: value }));
              setFieldValue('timezone', value);
            },
            'Select timezone',
            VALUE_PINS.timezone,
            'min-w-[14rem]',
          )
        ) : null}

        {nodeType !== 'googleCalendarDelete' ? (
          renderDropdownField(
            'sendUpdates',
            'Guest Email',
            draftValues.sendUpdates ?? String(getField('sendUpdates')?.value ?? 'all'),
            EMAIL_NOTIFICATION_OPTIONS,
            (value) => {
              setDraftValues((prev) => ({ ...prev, sendUpdates: value }));
              setFieldValue('sendUpdates', value);
            },
            'Select email behavior',
            VALUE_PINS.sendUpdates,
            'min-w-[14rem]',
          )
        ) : null}

        {nodeType === 'googleCalendarCreate' ? (
          renderDropdownField(
            'createMeetLink',
            'Google Meet',
            draftValues.createMeetLink ?? String(getField('createMeetLink')?.value ?? 'false'),
            MEET_LINK_OPTIONS,
            (value) => {
              setDraftValues((prev) => ({ ...prev, createMeetLink: value }));
              setFieldValue('createMeetLink', value);
            },
            'Select Meet behavior',
            VALUE_PINS.createMeetLink,
            'min-w-[14rem]',
          )
        ) : null}

        {nodeType !== 'googleCalendarDelete' ? (
          <>
            {nodeType === 'googleCalendarUpdate'
              ? renderTextField('eventId', 'Event Id', 'abc123@google.com', VALUE_PINS.eventId)
              : null}
            {renderTextField('summary', 'Summary', 'Team sync', VALUE_PINS.summary)}
            {renderTextField('description', 'Description', 'Agenda and notes', VALUE_PINS.description)}
            {renderTextField('location', 'Location', 'Conference room or URL', VALUE_PINS.location)}
            {renderTextField('start', 'Start', '2026-04-08T10:00:00+05:30', VALUE_PINS.start)}
            {renderTextField('end', 'End', '2026-04-08T10:30:00+05:30', VALUE_PINS.end)}
            {renderTextField('attendees', 'Attendees', 'a@x.com, b@y.com', VALUE_PINS.attendees)}
          </>
        ) : (
          renderTextField('eventId', 'Event Id', 'abc123@google.com', VALUE_PINS.eventId)
        )}

        <div className="relative pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  {OUTPUT_LABELS[nodeType] ?? 'Calendar payload'}
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
