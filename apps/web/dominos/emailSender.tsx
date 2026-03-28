import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import { useRouter, NextRouter } from 'next/router';
import { Mail, Send, Sparkles, Text, Type } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import SearchableSelect from '@/components/searchableDropdown';
import { EmailApi, EmailConnection } from '@/apis/email.apis';
import dominoCatalog from './dominos';

type DominoNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    setFieldValue?: (heading: string, newValue: unknown) => void;
  };
};

const emailMeta = dominoCatalog.find((entry) => entry.id === 'emailsender');
const emailAccentColor = emailMeta?.badgeStyle?.background
  ? String(emailMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

const FIELD_CONFIG = [
  {
    heading: 'to',
    label: 'Recipients',
    placeholder: 'name@example.com, team@example.com',
    pinId: 'value_in',
    type: 'textInput' as const,
    icon: Mail,
  },
  {
    heading: 'subject',
    label: 'Subject',
    placeholder: 'Quarterly update',
    pinId: 'value_in_1',
    type: 'textInput' as const,
    icon: Type,
  },
  {
    heading: 'body',
    label: 'Body',
    placeholder: 'Write the message that should be sent…',
    pinId: 'value_in_2',
    type: 'textArea' as const,
    icon: Text,
  },
  {
    heading: 'html',
    label: 'HTML',
    placeholder: '<p>Optional HTML version…</p>',
    pinId: 'value_in_3',
    type: 'textArea' as const,
    icon: Sparkles,
  },
  {
    heading: 'from',
    label: 'From Override',
    placeholder: 'Optional sender name or email',
    pinId: 'value_in_4',
    type: 'textInput' as const,
    icon: Send,
  },
];

export default function EmailSenderDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isPreviewMode = Boolean((data as DominoNodeData & { previewMode?: boolean }).previewMode);
  const router: NextRouter = useRouter();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const { getEdges } = useReactFlow();
  const bootstrappedRef = useRef(false);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading
      ),
    [data.details]
  );

  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);

  const vaultId = String(getField('vaultId')?.value ?? '');
  const selectedConn = useMemo(
    () => connections.find((conn) => conn.id === vaultId),
    [connections, vaultId]
  );

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;

    const setFieldValue = (heading: string, newValue: unknown) => {
      data.setNodes?.((nodes: DominoNodeRecord[]) =>
        nodes.map((node: DominoNodeRecord) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  details: {
                    ...node.data.details,
                    fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                      field.heading === heading ? { ...field, value: newValue } : field
                    ),
                  },
                },
              }
            : node
        )
      );
    };

    const initialFields: DominoField[] = [
      {
        type: 'dropdown',
        heading: 'vaultId',
        value: '',
        options: [],
        required: true,
        shouldRender: false,
      },
      {
        type: 'textInput',
        heading: 'to',
        value: '',
        inPinId: 'value_in',
        required: true,
        shouldRender: false,
      },
      {
        type: 'textInput',
        heading: 'subject',
        value: '',
        inPinId: 'value_in_1',
        required: false,
        shouldRender: false,
      },
      {
        type: 'textArea',
        heading: 'body',
        value: '',
        inPinId: 'value_in_2',
        required: false,
        shouldRender: false,
      },
      {
        type: 'textArea',
        heading: 'html',
        value: '',
        inPinId: 'value_in_3',
        required: false,
        shouldRender: false,
      },
      {
        type: 'textInput',
        heading: 'from',
        value: '',
        inPinId: 'value_in_4',
        required: false,
        shouldRender: false,
      },
    ];

    data.setNodes((prev: DominoNodeRecord[]) =>
      prev.map((node: DominoNodeRecord) => {
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
              type: 'EmailAction',
              description: 'Send an email to one or more recipients.',
              isTrigger: false,
              ...(details ?? {}),
              fields: mergedFields,
            } as DominoNodeData,
            exportFields:
              node.data.exportFields ?? ['vaultId', 'to', 'subject', 'body', 'html', 'from'],
            setFieldValue: node.data.setFieldValue ?? setFieldValue,
          },
        };
      })
    );

    bootstrappedRef.current = true;
  }, [data, id]);

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
        const list = await EmailApi.getConnections(token, router);
        if (mounted) setConnections(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error('Error fetching email connections', error);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isPreviewMode, token, router]);

  const setFieldValue = useCallback(
    (heading: string, value: string) => {
      clearValidationForDominoId(id);
      data.setFieldValue?.(heading, value);
      if (!data.setFieldValue && data.setNodes) {
        data.setNodes((nodes: DominoNodeRecord[]) =>
          nodes.map((node: DominoNodeRecord) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    details: {
                      ...node.data.details,
                      fields: (node.data.details?.fields ?? []).map((field: DominoField) =>
                        field.heading === heading ? { ...field, value } : field
                      ),
                    },
                  },
                }
              : node
          )
        );
      }
    },
    [clearValidationForDominoId, data, id]
  );

  const startOAuth = async () => {
    const url = await EmailApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const isHandleConnected = (handleId: string) =>
    getEdges().some((edge) => edge.target === id && edge.targetHandle === handleId);

  const renderTextField = ({
    heading,
    label,
    placeholder,
    pinId,
    type,
    icon: Icon,
  }: (typeof FIELD_CONFIG)[number]) => {
    const field = getField(heading);
    const value = String(field?.value ?? '');
    const connected = isHandleConnected(pinId);
    const isTextArea = type === 'textArea';

    return (
      <div key={heading} className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-4">
          <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
            <Icon className="h-3 w-3" />
            {label}
          </div>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
            {connected ? 'Live input' : 'Static input'}
          </span>
        </div>

        <div className="pb-4">
          <div className="relative">
            <div className="flex items-start gap-2 px-4">
              <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline />
              <div
                className={`min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10 ${
                  isTextArea ? 'min-h-24' : 'min-h-12'
                }`}
              >
                {connected ? (
                  <div
                    className={`flex h-full items-center px-4 text-sm font-medium italic text-slate-500 dark:text-slate-400 ${
                      isTextArea ? 'min-h-24 py-3' : 'min-h-12 py-3'
                    }`}
                  >
                    Connected
                  </div>
                ) : isTextArea ? (
                  <textarea
                    value={value}
                    onChange={(event) => setFieldValue(heading, event.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="nodrag min-h-24 w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none transition placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(event) => setFieldValue(heading, event.target.value)}
                    placeholder={placeholder}
                    className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none transition placeholder:text-inherit dark:text-dominofy-dark-text"
                  />
                )}
              </div>
            </div>
          </div>
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
    >
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={emailAccentColor ? { borderColor: emailAccentColor, backgroundColor: `${emailAccentColor}22` } : undefined}
          >
            <Mail
              className="h-4 w-4"
              style={emailAccentColor ? { color: emailAccentColor } : emailMeta?.iconStyle}
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Email Action
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Action
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-5 pb-5 pt-5">
        <div className="space-y-4 px-4 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Mail className="h-3 w-3" />
              Account
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Gmail
            </span>
          </div>

          <button
            type="button"
            className="w-full rounded-lg border border-transparent bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            onClick={startOAuth}
          >
            {connections.length === 0 ? 'Connect Gmail' : 'Add Gmail connection'}
          </button>

          {loadingConns ? (
            <div className="rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              Loading Gmail connections…
            </div>
          ) : connections.length > 0 ? (
            <div className="space-y-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Sending account
              </div>
              <div className="rounded-lg border border-slate-300/80 bg-dominofy-light-surface px-1 py-1 dark:border-slate-600 dark:bg-dominofy-dark-surface">
                <SearchableSelect
                  value={vaultId}
                  onChange={(newVaultId) => setFieldValue('vaultId', newVaultId)}
                  placeholder="Select account"
                  options={connections.map((connection) => ({
                    label: connection.email || connection.name,
                    value: connection.id,
                  }))}
                />
              </div>
              {selectedConn && (
                <div className="text-xs text-foreground/55 dark:text-slate-400">
                  Sending as {selectedConn.email || selectedConn.name}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              Connect Gmail to send messages from this workflow.
            </div>
          )}
        </div>

        <div className="space-y-2">
          {FIELD_CONFIG.map(renderTextField)}
        </div>

        <div className="relative px-4 pb-4 pt-1">
          <div className="relative rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                  Output
                </div>
                <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
                  Sent email payload
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
