import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDomino } from '../contexts/dominoContext';
import { FiCpu, FiAlertCircle } from 'react-icons/fi';

type LLMField = {
  type: string;
  heading: string;
  placeholder?: string;
  value?: unknown;
  required?: boolean;
  inPinId?: string;
};

type LLMNode = {
  id: string;
  data: {
    details?: {
      description?: string;
      fields?: LLMField[];
    };
    exportFields?: string[];
    [key: string]: unknown;
  };
};

export default function LLMDomino({ data, id, selected }: NodeProps) {
  const MIN_PROMPT_HEIGHT = 80;
  const MAX_PROMPT_HEIGHT = 160;
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isPromptConnected = data?.promptConnected ?? false;
  const setNodesRef = useRef(data.setNodes);
  const setFieldValueRef = useRef(data.setFieldValue);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    setNodesRef.current = data.setNodes;
  }, [data.setNodes]);
  useEffect(() => {
    setFieldValueRef.current = data.setFieldValue;
  }, [data.setFieldValue]);

  const [prompt, setPrompt] = useState("");

  const syncPromptFieldValue = useCallback((nextPrompt: string) => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;
    setNodes((nodes: LLMNode[]) =>
      nodes.map((node: LLMNode) => {
        if (node.id !== id) return node;
        const fields = node.data.details?.fields ?? [];
        const updatedFields = fields.map((field) =>
          field.heading === "Prompt" ? { ...field, value: nextPrompt } : field
        );
        const changed = fields.some(
          (field, index) =>
            field.heading === "Prompt" && updatedFields[index]?.value !== field.value
        );
        if (!changed) return node;
        return {
          ...node,
          data: {
            ...node.data,
            details: {
              ...node.data.details,
              fields: updatedFields,
            },
          },
        };
      })
    );
  }, [id]);

  const autoSizePrompt = useCallback(() => {
    const textarea = promptTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, MIN_PROMPT_HEIGHT), MAX_PROMPT_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > MAX_PROMPT_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    autoSizePrompt();
  }, [autoSizePrompt, prompt, isPromptConnected]);

  const normalizeNodeFields = useCallback((promptValue: string) => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const nextFields = [
      {
        type: 'textInput',
        heading: 'Prompt',
        placeholder: 'Enter your prompt here...',
        value: promptValue,
        required: true,
        inPinId: 'value_in',
      },
    ];

    const nextExport = ['Prompt'];

    setNodes((nodes: LLMNode[]) =>
      nodes.map((node: LLMNode) => {
        if (node.id !== id) return node;
        const existingFields = node.data.details?.fields ?? [];
        const sameFields =
          existingFields.length === nextFields.length &&
          existingFields.every((f: LLMField, idx: number) => JSON.stringify(f) === JSON.stringify(nextFields[idx]));
        const sameExport =
          Array.isArray(node.data.exportFields) &&
          node.data.exportFields.length === nextExport.length &&
          node.data.exportFields.every((h: string, i: number) => h === nextExport[i]);
        const sameDescription = node.data.details?.description === 'Sends a prompt to AI and returns the response.';
        if (sameFields && sameExport && sameDescription) return node;

        return {
          ...node,
          data: {
            ...node.data,
            details: {
              type: 'LLM',
              description: 'Sends a prompt to AI and returns the response.',
              fields: nextFields,
            },
            exportFields: nextExport,
            setFieldValue: (heading: string, value: unknown) => {
              if (heading === 'Prompt') {
                const nextPrompt = typeof value === 'string' ? value : String(value ?? '');
                setPrompt(nextPrompt);
                syncPromptFieldValue(nextPrompt);
              }
            },
          },
        };
      })
    );
  }, [id, syncPromptFieldValue]);

  useEffect(() => {
    const fields = data.details?.fields ?? [];
    const promptField = fields.find((f: LLMField) => f.heading === 'Prompt');
    const promptValue = typeof promptField?.value === 'string' ? promptField.value : '';
    setPrompt(promptValue);

    const hasOnlyPromptField =
      fields.length === 1 &&
      promptField &&
      promptField.type === 'textInput' &&
      promptField.inPinId === 'value_in';
    const hasOnlyPromptExport =
      Array.isArray(data.exportFields) &&
      data.exportFields.length === 1 &&
      data.exportFields[0] === 'Prompt';

    if (!hasOnlyPromptField || !hasOnlyPromptExport) {
      normalizeNodeFields(promptValue);
    }
  }, [data.details?.fields, data.exportFields, normalizeNodeFields]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setPrompt(newValue);
    setFieldValueRef.current?.('Prompt', newValue);
    syncPromptFieldValue(newValue);
    clearValidationForDominoId(id);
  }, [clearValidationForDominoId, id, syncPromptFieldValue]);

  const handlePromptWheelCapture = useCallback((e: React.WheelEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={`transition-all duration-150 rounded-md w-96 overflow-visible shadow-sm
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4'
            : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header with exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{ backgroundColor: '#7c3aed', borderBottomColor: '#6d28d9', borderRadius: '0.23rem 0.23rem 0 0' }}
      >
        <div className="flex items-center gap-1.5">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <FiCpu className="mr-0.5" />
          <span className="truncate">AI</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Main content */}
      <div className="pt-2 pb-1">
        {/* Prompt input section */}
        <div>
          <label className="block px-3 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Prompt
          </label>
          
          <div className="relative px-3 flex items-center gap-2">
            <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
            {!isPromptConnected ? (
              <div className="relative flex-1">
                <textarea
                  ref={promptTextareaRef}
                  value={prompt}
                  onChange={handlePromptChange}
                  onWheelCapture={handlePromptWheelCapture}
                  placeholder="Enter your prompt here..."
                  className="nodrag nowheel w-full px-3 py-2 text-sm border rounded-md bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text resize-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  style={{ minHeight: `${MIN_PROMPT_HEIGHT}px`, maxHeight: `${MAX_PROMPT_HEIGHT}px` }}
                  rows={1}
                />
              </div>
            ) : (
              <div className="flex-1 px-3 py-2 text-xs italic text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-md border border-dashed border-gray-300 dark:border-gray-600">
                Prompt connected from previous step
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="relative px-3 py-2 rounded-b-md flex items-center justify-between">
        <div />
        <span className="text-xs text-dominofy-light-text dark:text-dominofy-dark-text">Output</span>
        <DominoPin id="value_out" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <div className="px-3 py-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 flex items-center gap-1.5 border-t border-red-100 dark:border-red-900/30">
          <FiAlertCircle className="flex-shrink-0" />
          <span>Missing required connection</span>
        </div>
      )}
    </div>
  );
}
