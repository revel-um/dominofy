import { NodeProps, useEdges } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrainCircuit, Sparkles } from 'lucide-react';

import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type LLMNodeRecord = {
  id: string;
  data: {
    details?: DominoNodeData;
    exportFields?: string[];
    setFieldValue?: (heading: string, newValue: unknown) => void;
    setNodes?: (
      updater: (nodes: LLMNodeRecord[]) => LLMNodeRecord[]
    ) => void;
  };
};

const llmMeta = dominoCatalog.find((entry) => entry.id === 'llm');
const llmAccentColor = llmMeta?.badgeStyle?.background
  ? String(llmMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
  : undefined;

export default function LLMDomino({ data, id, selected }: NodeProps) {
  const MIN_PROMPT_HEIGHT = 112;
  const MAX_PROMPT_HEIGHT = 192;
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const edges = useEdges();
  const bootstrappedRef = useRef(false);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const getField = useCallback(
    (heading: string) =>
      (data.details as DominoNodeData | undefined)?.fields?.find(
        (field) => field.heading === heading
      ),
    [data.details]
  );

  const [prompt, setPrompt] = useState<string>(() => {
    const value = getField('Prompt')?.value;
    return typeof value === 'string' ? value : '';
  });

  const isPromptConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === 'value_in'
  );

  useEffect(() => {
    const nextValue = getField('Prompt')?.value;
    if (typeof nextValue === 'string' && nextValue !== prompt) {
      setPrompt(nextValue);
    }
  }, [getField, prompt]);

  const autoSizePrompt = useCallback(() => {
    const textarea = promptTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, MIN_PROMPT_HEIGHT),
      MAX_PROMPT_HEIGHT
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_PROMPT_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    autoSizePrompt();
  }, [autoSizePrompt, prompt, isPromptConnected]);

  useEffect(() => {
    if (!data.setNodes || bootstrappedRef.current) return;

    const setFieldValue = (heading: string, newValue: unknown) => {
      if (heading === 'Prompt') setPrompt(String(newValue ?? ''));
      data.setNodes?.((nodes: LLMNodeRecord[]) =>
        nodes.map((node: LLMNodeRecord) =>
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

    const initialField: DominoField = {
      type: 'textInput',
      heading: 'Prompt',
      placeholder: 'Enter your prompt here...',
      value: prompt,
      required: true,
      inPinId: 'value_in',
      shouldRender: false,
    };

    data.setNodes((prev: LLMNodeRecord[]) =>
      prev.map((node: LLMNodeRecord) => {
        if (node.id !== id) return node;

        const details = node.data.details as DominoNodeData | undefined;
        const fields = details?.fields ?? [];
        const existingField = fields.find((field) => field.heading === 'Prompt');
        const mergedField = existingField ? { ...initialField, ...existingField } : initialField;

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              type: 'LLM',
              description: 'Run a prompt through an AI language model.',
              ...(details ?? {}),
              fields: [mergedField],
            } as DominoNodeData,
            exportFields: node.data.exportFields ?? ['Prompt'],
            setFieldValue: node.data.setFieldValue ?? setFieldValue,
          },
        };
      })
    );

    bootstrappedRef.current = true;
  }, [data, id, prompt]);

  const setFieldValue = useCallback(
    (heading: string, value: string) => {
      clearValidationForDominoId(id);
      if (heading === 'Prompt') setPrompt(value);
      data.setFieldValue?.(heading, value);
      if (!data.setFieldValue && data.setNodes) {
        data.setNodes((nodes: LLMNodeRecord[]) =>
          nodes.map((node: LLMNodeRecord) =>
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative flex items-start justify-between gap-3 rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3 pr-3">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
            style={
              llmAccentColor
                ? {
                    borderColor: llmAccentColor,
                    backgroundColor: `${llmAccentColor}22`,
                  }
                : undefined
            }
          >
            <BrainCircuit
              className="h-4 w-4"
              style={
                llmAccentColor ? { color: llmAccentColor } : llmMeta?.iconStyle
              }
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              AI
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
              Action
            </div>
          </div>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      <div className="relative space-y-4 pb-4 pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-4">
            <div className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Sparkles className="h-3 w-3" />
              Prompt
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {isPromptConnected ? 'Live input' : 'Static input'}
            </span>
          </div>

          <div className="pb-4">
            <div className="relative">
              <div className="flex items-start gap-2 px-4">
                <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
                <div className="nodrag min-w-0 flex-1 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
                  {isPromptConnected ? (
                    <div className="nodrag flex min-h-28 items-start px-4 py-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
                      Connected
                    </div>
                  ) : (
                    <textarea
                      ref={promptTextareaRef}
                      value={prompt}
                      onChange={(event) => setFieldValue('Prompt', event.target.value)}
                      placeholder="Enter your prompt here..."
                      rows={1}
                      className="nodrag w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none transition placeholder:text-inherit dark:text-dominofy-dark-text"
                      style={{
                        minHeight: `${MIN_PROMPT_HEIGHT}px`,
                        maxHeight: `${MAX_PROMPT_HEIGHT}px`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative pb-2 pt-1">
          <div className="flex items-center justify-end gap-2 px-4">
            <div className="min-w-0 text-right text-sm font-medium text-foreground/65 dark:text-slate-300">
              Output
            </div>
            <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
          </div>
        </div>
      </div>
    </div>
  );
}
