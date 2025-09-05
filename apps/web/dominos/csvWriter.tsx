import { NodeProps } from 'reactflow';
import { useCallback, useEffect, useState } from 'react';
import { FiDownload, FiFileText } from 'react-icons/fi';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useDomino } from '../contexts/dominoContext';

interface CSVWriterConfig {
  fileName: string;
  includeHeader: boolean;
  delimiter: string;
  data: any[];
  lastExport: Date | null;
}

export default function CSVWriterDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  
  const [config, setConfig] = useState<CSVWriterConfig>({
    fileName: 'export',
    includeHeader: true,
    delimiter: ',',
    data: [],
    lastExport: null
  });

  // Update node fields in the React Flow graph
  const updateNodeFields = useCallback((updatedConfig: CSVWriterConfig) => {
    if (!data.setNodes) return;

    const updatedFields = [
      {
        type: 'text',
        heading: 'File Name',
        value: updatedConfig.fileName,
        inPinId: 'value_in_1',
        required: true,
        shouldRender: true,
      },
      {
        type: 'checkbox',
        heading: 'Include Header',
        value: updatedConfig.includeHeader,
        inPinId: 'value_in_2',
        required: false,
        shouldRender: true,
      },
      {
        type: 'select',
        heading: 'Delimiter',
        value: updatedConfig.delimiter,
        options: [
          { label: 'Comma (,)', value: ',' },
          { label: 'Semicolon (;)', value: ';' },
          { label: 'Tab (\t)', value: '\t' },
          { label: 'Pipe (|)', value: '|' },
        ],
        inPinId: 'value_in_3',
        required: true,
        shouldRender: true,
      },
    ];

    data.setNodes((nodes: any[]) =>
      nodes.map((n: any) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                details: { ...n.data.details, fields: updatedFields },
                exportFields: ['File Name', 'Include Header', 'Delimiter'],
              },
            }
          : n
      )
    );
  }, [data.setNodes, id]);

  // Initialize node data
  useEffect(() => {
    if (!data.setNodes) return;

    // Only initialize if fields don't exist yet
    if (!data.details?.fields || data.details.fields.length === 0) {
      updateNodeFields(config);
    } else {
      // Update local state from existing node data
      const fields = data.details.fields || [];
      const getFieldValue = (heading: string, defaultValue: any) => 
        fields.find((f: any) => f.heading === heading)?.value ?? defaultValue;

      setConfig({
        fileName: getFieldValue('File Name', config.fileName),
        includeHeader: getFieldValue('Include Header', config.includeHeader),
        delimiter: getFieldValue('Delimiter', config.delimiter),
        data: config.data, // Keep existing data
        lastExport: config.lastExport, // Keep existing lastExport
      });
    }
  }, [data.details?.fields, data.setNodes, id, updateNodeFields]);

  // Handle field changes
  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newConfig = { ...config, fileName: e.target.value };
    setConfig(newConfig);
    updateNodeFields(newConfig);
    clearValidationForDominoId(id);
  };

  const handleIncludeHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newConfig = { ...config, includeHeader: e.target.checked };
    setConfig(newConfig);
    updateNodeFields(newConfig);
    clearValidationForDominoId(id);
  };

  const handleDelimiterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newConfig = { ...config, delimiter: e.target.value };
    setConfig(newConfig);
    updateNodeFields(newConfig);
    clearValidationForDominoId(id);
  };

  // Alias for handleFieldChange to maintain compatibility with existing code
  const handleFieldChange = (field: keyof CSVWriterConfig, value: any) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    updateNodeFields(newConfig);
    clearValidationForDominoId(id);
  };

  // Convert data to CSV format
  const convertToCSV = (data: any[]): string => {
    if (!data || data.length === 0) return '';
    
    const headers = config.includeHeader 
      ? Object.keys(data[0] || {})
      : [];
    
    const csvRows = [];
    
    // Add header row if needed
    if (headers.length > 0) {
      csvRows.push(headers.join(config.delimiter));
    }
    
    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape quotes and wrap in quotes if contains delimiter or newline
        const escaped = ('' + value).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(config.delimiter));
    }
    
    return csvRows.join('\n');
  };

  // Handle download
  const handleDownload = () => {
    try {
      const csvContent = convertToCSV(config.data);
      if (!csvContent) {
        console.warn('No data to export');
        return;
      }
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${config.fileName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Update last export time
      setConfig(prev => ({
        ...prev,
        lastExport: new Date()
      }));
      
    } catch (error) {
      console.error('Error generating CSV:', error);
    }
  };

  // Format date for display
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <div
      className={`transition-all duration-150 rounded-md w-64 overflow-visible shadow-sm ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4'
            : 'unselected-border dark:border-gray-600'
      } bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header */}
      <div
        className="flex justify-between text-sm font-semibold text-white border-b rounded-t-md"
        style={{
          backgroundColor: '#8b5cf6',
          borderBottomColor: '#7c3aed',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1 px-3 py-2">
          <FiFileText className="w-4 h-4" />
          <span>CSV Writer</span>
        </div>
        <div className="flex items-center pr-2">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
          <DominoPin id="value_in" pinType={PinType.VALUE_IN} inline />
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-3 p-3">
        {/* File Name */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            File Name
          </label>
          <input
            type="text"
            value={config.fileName}
            onChange={(e) => handleFieldChange('fileName', e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            placeholder="export"
          />
        </div>

        {/* Delimiter */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Delimiter
          </label>
          <select
            value={config.delimiter}
            onChange={(e) => handleFieldChange('delimiter', e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          >
            <option value=",">Comma (,)</option>
            <option value="\t">Tab (\t)</option>
            <option value=";">Semicolon (;)</option>
            <option value="|">Pipe (|)</option>
          </select>
        </div>

        {/* Include Header */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="includeHeader"
            checked={config.includeHeader}
            onChange={(e) => handleFieldChange('includeHeader', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="includeHeader" className="text-xs text-gray-700 dark:text-gray-300">
            Include Header Row
          </label>
        </div>

        {/* Preview */}
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/30 rounded border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {config.data.length > 0 
              ? `${config.data.length} row${config.data.length !== 1 ? 's' : ''} of data`
              : 'No data available'}
          </div>
          {config.lastExport && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Last exported: {formatDate(config.lastExport)}
            </div>
          )}
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={!config.data || config.data.length === 0}
          className={`w-full flex items-center justify-center gap-2 mt-2 px-3 py-1.5 text-sm font-medium rounded-md text-white ${
            config.data && config.data.length > 0
              ? 'bg-purple-600 hover:bg-purple-700'
              : 'bg-gray-400 cursor-not-allowed'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
        >
          <FiDownload className="w-4 h-4" />
          Download CSV
        </button>
      </div>
    </div>
  );
}
