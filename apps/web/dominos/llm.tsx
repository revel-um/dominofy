import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState, useCallback } from 'react';
import { DominoField, DominoNodeData } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';
import { FiCpu, FiAlertCircle, FiChevronDown, FiSliders, FiCode, FiZap } from 'react-icons/fi';

type LLMProvider = 'openai' | 'anthropic' | 'google' | 'mistral';

type LLMModel = {
  id: string;
  name: string;
  provider: LLMProvider;
  maxTokens: number;
  description: string;
};

const AVAILABLE_MODELS: LLMModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 128000,
    description: 'Most capable model, great for complex tasks',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    maxTokens: 128000,
    description: 'Powerful and fast, great balance of capability and speed',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    maxTokens: 16385,
    description: 'Fast and cost-effective for simpler tasks',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    maxTokens: 200000,
    description: 'Most capable model, excelling at highly complex tasks',
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    maxTokens: 200000,
    description: 'Ideal balance of intelligence and speed',
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    maxTokens: 32768,
    description: 'Google\'s most capable model for a wide range of tasks',
  },
  {
    id: 'mixtral-8x7b',
    name: 'Mixtral 8x7B',
    provider: 'mistral',
    maxTokens: 32768,
    description: 'High-quality open-weight model',
  },
];

interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stream: boolean;
}

const getProviderColor = (provider: LLMProvider) => {
  const colors = {
    openai: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    anthropic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    google: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    mistral: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  };
  return colors[provider] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
};

export default function LLMDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const isPromptConnected = data?.promptConnected ?? false;
  
  // State for the prompt, config, and UI
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModel>(AVAILABLE_MODELS[0]);
  const [config, setConfig] = useState<LLMConfig>({
    model: AVAILABLE_MODELS[0].id,
    temperature: 0.7,
    maxTokens: 500,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stream: true,
  });
  
  // Update selected model when config.model changes
  useEffect(() => {
    const model = AVAILABLE_MODELS.find(m => m.id === config.model) || AVAILABLE_MODELS[0];
    setSelectedModel(model);
    
    // Update maxTokens if the model's max is lower than current setting
    if (config.maxTokens > model.maxTokens) {
      setConfig(prev => ({
        ...prev,
        maxTokens: model.maxTokens
      }));
    }
  }, [config.model]);

  // Sync values from data.details.fields
  useEffect(() => {
    const promptField = data?.details?.fields?.find((f: DominoField) => f.heading === 'Prompt');
    const configField = data?.details?.fields?.find((f: DominoField) => f.heading === 'Config');
    
    if (promptField?.value !== undefined) {
      setPrompt(promptField.value);
    }
    
    if (configField?.value) {
      try {
        const parsedConfig = typeof configField.value === 'string' 
          ? JSON.parse(configField.value) 
          : configField.value;
          
        // Find the model in our available models
        const model = AVAILABLE_MODELS.find(m => m.id === parsedConfig.model) || AVAILABLE_MODELS[0];
        
        setConfig(prev => ({
          ...prev,
          ...parsedConfig,
          model: model.id,
          temperature: parsedConfig.temperature ?? 0.7,
          maxTokens: Math.min(parsedConfig.maxTokens ?? 500, model.maxTokens),
          stream: parsedConfig.stream ?? true,
        }));
        
        setSelectedModel(model);
      } catch (e) {
        console.error('Failed to parse LLM config', e);
      }
    }
  }, [data?.details?.fields]);

  // Handle model selection change
  const handleModelChange = (modelId: string) => {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
    setSelectedModel(model);
    
    const newConfig = {
      ...config,
      model: model.id,
      maxTokens: Math.min(config.maxTokens, model.maxTokens)
    };
    
    setConfig(newConfig);
    updateConfig(newConfig);
  };
  
  // Update config in parent
  const updateConfig = useCallback((newConfig: LLMConfig) => {
    data.setFieldValue?.('Config', newConfig);
  }, [data]);
  
  // Handle config changes
  const handleConfigChange = (key: keyof LLMConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    updateConfig(newConfig);
  };
  
  // Initialize node data if not already set
  useEffect(() => {
    if ((!data.setFieldValue || !data.details) && data.setNodes) {
      const setFieldValue = (heading: string, value: any) => {
        if (heading === 'Prompt') {
          setPrompt(value);
        } else if (heading === 'Config' && value) {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            setConfig(prev => ({
              ...prev,
              ...parsed,
              model: parsed.model || AVAILABLE_MODELS[0].id,
            }));
          } catch (e) {
            console.error('Invalid config format', e);
          }
        }

        data.setNodes?.((nodes: any[]) =>
          nodes.map((n: { id: string; data: { details: { fields: DominoField[]; }; }; }) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    details: {
                      ...n.data.details,
                      fields: n.data.details.fields.map((f: DominoField) =>
                        f.heading === heading ? { ...f, value } : f
                      ),
                    },
                  },
                }
              : n
          )
        );
      };

      data.setNodes((prev: any[]) =>
        prev.map((node: { id: string; data: { details: any; }; }) =>
          node.id !== id
            ? node
            : {
                ...node,
                data: {
                  ...node.data,
                  details: node.data.details ?? {
                    type: 'LLM',
                    description: 'Sends a prompt to an AI language model and returns the response.',
                    fields: [
                      {
                        type: 'textInput',
                        heading: 'Prompt',
                        placeholder: 'Enter your prompt here...',
                        value: prompt,
                        required: true,
                        inPinId: 'prompt_in',
                      },
                      {
                        type: 'json',
                        heading: 'Config',
                        value: JSON.stringify(config, null, 2),
                        required: false,
                      },
                    ],
                  },
                  exportFields: ['Prompt', 'Config'],
                  setFieldValue,
                },
              }
        )
      );
    }
  }, [data, id, prompt, config]);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    clearValidationForDominoId(id);
    const newValue = e.target.value;
    setPrompt(newValue);
    data.setFieldValue?.('Prompt', newValue);
  };
  
  const toggleAdvanced = () => {
    setShowAdvanced(!showAdvanced);
  };
  
  // Format model provider name
  const formatProviderName = (provider: string) => {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

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
          <span className="truncate">AI Language Model</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${getProviderColor(selectedModel.provider)}`}>
            <span className="truncate max-w-[80px]">{selectedModel.name}</span>
          </div>
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      {/* Main content */}
      <div className="p-3">
        {/* Model Selection */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Model
          </label>
          <div className="relative">
            <select
              value={selectedModel.id}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({formatProviderName(model.provider)})
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <FiChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {selectedModel.description}
          </div>
        </div>

        {/* Prompt input section */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Prompt
            </label>
            <DominoPin id="prompt_in" pinType={PinType.VALUE_IN} inline />
          </div>
          
          {!isPromptConnected ? (
            <div className="relative">
              <textarea
                value={prompt}
                onChange={handlePromptChange}
                placeholder="Enter your prompt here..."
                className="w-full px-3 py-2 text-sm border rounded-md bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text min-h-[80px] max-h-40 resize-y focus:ring-1 focus:ring-purple-500 focus:border-purple-500 pr-10"
                rows={3}
              />
              <div className="absolute right-2 bottom-2 text-xs text-gray-500 bg-white/90 dark:bg-gray-800/90 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                {prompt.length} chars
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 text-xs italic text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-md border border-dashed border-gray-300 dark:border-gray-600">
              Prompt connected from previous step
            </div>
          )}
        </div>

        {/* Add margin to create space */}
        <div className="h-3"></div>

        {/* Advanced settings toggle */}
        <div className="relative z-10 mt-1">
          <button
            onClick={toggleAdvanced}
            className="w-full flex items-center justify-between text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 mb-2 bg-white dark:bg-gray-800 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <FiSliders className="h-3.5 w-3.5 flex-shrink-0" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </span>
            <FiChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ${showAdvanced ? 'transform rotate-180' : ''}`} />
          </button>
        </div>

        {/* Advanced settings */}
        {showAdvanced && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              {/* Temperature */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Temperature: {config.temperature.toFixed(1)}
                  </label>
                  <span className="text-xs text-gray-500">
                    {config.temperature < 0.3 ? 'Precise' : 
                     config.temperature < 0.7 ? 'Balanced' : 'Creative'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                  <span>Precise</span>
                  <span>Balanced</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Max Tokens: {config.maxTokens}
                  </label>
                  <span className="text-xs text-gray-500">
                    Max: {selectedModel.maxTokens.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max={selectedModel.maxTokens}
                  step="100"
                  value={config.maxTokens}
                  onChange={(e) => handleConfigChange('maxTokens', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
              </div>

              {/* Top P */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Top P: {config.topP.toFixed(1)}
                  </label>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.topP}
                  onChange={(e) => handleConfigChange('topP', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
              </div>

              {/* Stream toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Stream Response
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.stream}
                    onChange={(e) => handleConfigChange('stream', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Model stats */}
        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${getProviderColor(selectedModel.provider)}`}></div>
              <span className="font-medium">{formatProviderName(selectedModel.provider)}</span>
            </div>
            <div className="text-gray-500">
              Max tokens: {selectedModel.maxTokens.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Output section */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 rounded-b-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FiZap className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-xs font-medium">Response</span>
          </div>
          <DominoPin id="response_out" pinType={PinType.VALUE_OUT} inline />
        </div>
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
