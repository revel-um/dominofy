import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import { useRouter, NextRouter } from 'next/router';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { getExpandedDominoHeaderStyle } from './dominoHeaderStyle';
import SearchableSelect from '@/components/searchableDropdown';
import { EmailApi, EmailConnection } from '@/apis/email.apis';

export default function EmailSenderDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isPreviewMode = Boolean((data as any).previewMode);

  const router: NextRouter = useRouter();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const { getEdges } = useReactFlow();

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        f => f.heading === heading,
      ),
    [data.details],
  );

  const vaultId: string = getField('vaultId')?.value ?? '';
  const toValue: string = getField('to')?.value ?? '';
  const subjectValue: string = getField('subject')?.value ?? '';
  const bodyValue: string = getField('body')?.value ?? '';
  const htmlValue: string = getField('html')?.value ?? '';
  const fromValue: string = getField('from')?.value ?? '';

  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const bootstrappedRef = useRef(false);
  const safeConnections = Array.isArray(connections) ? connections : [];

  /* Initialise node schema once */
  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;
    data.setNodes((prev: any[]) => {
      let changed = false;
      const next = prev.map(node => {
        if (node.id !== id) return node;
        const newData: any = { ...node.data };
        const details: DominoNodeData | undefined = newData.details;
        const exportFields = ['vaultId', 'to', 'subject', 'body', 'html', 'from'];
        if (!details?.fields) {
          newData.details = {
            type: 'EmailAction',
            description: 'Send an email using a connected Gmail account.',
            isTrigger: false,
            fields: [
              { type: 'dropdown', heading: 'vaultId', value: '', options: [], required: true, shouldRender: false },
              { type: 'textInput', heading: 'to', value: '', inPinId: 'value_in_1', required: true, shouldRender: false },
              { type: 'textInput', heading: 'subject', value: '', inPinId: 'value_in_2', required: true, shouldRender: false },
              { type: 'textArea', heading: 'body', value: '', inPinId: 'value_in_3', required: true, shouldRender: false },
              { type: 'textArea', heading: 'html', value: '', inPinId: 'value_in_4', required: false, shouldRender: false },
              { type: 'textInput', heading: 'from', value: '', inPinId: 'value_in_5', required: false, shouldRender: false },
            ],
          } as DominoNodeData;
          newData.exportFields = exportFields;
          changed = true;
        } else if (!newData.exportFields) {
          newData.exportFields = exportFields;
          changed = true;
        }
        return changed ? { ...node, data: newData } : node;
      });
      bootstrappedRef.current = true;
      return changed ? next : prev;
    });
  }, [data.setNodes, id]);

  /* Helper to set a field inside details.fields */
  const setFieldValue = useCallback(
    (heading: string, val: string) => {
      clearValidationForDominoId?.(id);
      data.setNodes?.((nodes: any[]) =>
        nodes.map((n: { id: string; data: any }) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...(n.data.details as DominoNodeData),
                    fields: (n.data.details as DominoNodeData).fields.map(f =>
                      f.heading === heading ? { ...f, value: val } : f,
                    ),
                  },
                },
              }
            : n,
        ),
      );
    },
    [data.setNodes, id, clearValidationForDominoId],
  );

  const isConnected = useCallback(
    (pinId: string) =>
      getEdges().some(e => e.target === id && e.targetHandle === pinId),
    [getEdges, id],
  );

  /* Load Gmail connections */
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
      } catch (err) {
        console.error('Error fetching email connections', err);
      } finally {
        if (mounted) setLoadingConns(false);
      }
    })();
    return () => void (mounted = false);
  }, [isPreviewMode, token, router]);

  const startOAuth = async () => {
    const url = await EmailApi.getInstallUrl(token, router);
    if (url) window.location.href = url;
  };

  const renderTextField = (
    label: string,
    value: string,
    pinId: string,
    onChange: (val: string) => void,
    placeholder: string,
    isTextArea: boolean = false,
  ) => {
    const connected = isConnected(pinId);
    return (
      <div className="flex items-start gap-2 relative px-3">
        <DominoPin id={pinId} pinType={PinType.VALUE_IN} inline />
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
          {connected ? (
            <div className="px-2 py-1 italic text-gray-500 text-sm">Connected</div>
          ) : isTextArea ? (
            <textarea
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="mt-1 w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              className="mt-1 w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
      style={{ minWidth: '13rem' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={getExpandedDominoHeaderStyle('emailsender')}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span>Email Action</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="flex flex-col gap-3 py-2 text-dominofy-light-text dark:text-dominofy-dark-text">
        {/* Connect Gmail */}
        <div className="px-3">
          <button
            type="button"
            className="w-full px-2 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
            onClick={startOAuth}
          >
            {safeConnections.length === 0 ? 'Connect Gmail' : 'Add Gmail connection'}
          </button>
        </div>

        {/* Select connection */}
        {loadingConns ? (
          <p className="text-sm px-3">Loading Gmail connections…</p>
        ) : safeConnections.length > 0 ? (
          <div className="flex flex-col gap-1 px-3">
            <label className="text-xs font-medium">Gmail Account</label>
            <SearchableSelect
              value={vaultId}
              onChange={val => setFieldValue('vaultId', val)}
              placeholder="Select account"
              options={safeConnections.map(c => ({
                label: c.email || c.name,
                value: c.id,
              }))}
            />
          </div>
        ) : (
          <p className="text-sm px-3 text-gray-600">
            Connect Gmail to send emails.
          </p>
        )}

        {renderTextField('To', toValue, 'value_in_1', val => setFieldValue('to', val), 'user@example.com')}
        {renderTextField('Subject', subjectValue, 'value_in_2', val => setFieldValue('subject', val), 'Hello from Dominofy')}
        {renderTextField('Body', bodyValue, 'value_in_3', val => setFieldValue('body', val), 'Plain text body', true)}
        {renderTextField('HTML (optional)', htmlValue, 'value_in_4', val => setFieldValue('html', val), '<p>Rich email body</p>', true)}
        {renderTextField('From override (optional)', fromValue, 'value_in_5', val => setFieldValue('from', val), 'you@gmail.com')}

        <div className="px-3 flex items-center justify-between relative">
          <div></div>
          <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Output</span>
          <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
        </div>
      </div>

      {hasError && (
        <p className="px-3 pb-2 text-xs text-red-500">
          ⚠️ Please configure connection, execution, and required fields.
        </p>
      )}
    </div>
  );
}
