import { NodeProps } from 'reactflow';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { useEffect, useState } from 'react';
import {
  DominoField,
  DominoFieldOption,
  DominoNodeData,
} from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

export default function SQLRunnerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);

  // Track whether the "Connect" button has been clicked
  const [connected, setConnected] = useState<boolean>(
    Boolean(
      data.details?.fields.find((f: any) => f.heading === 'Connection Name')
    )
  );

  // Local state to manage the SQL query
  const [query, setQuery] = useState<string>(
    (data.details?.fields.find((f: any) => f.heading === 'Query')?.value as string) || ''
  );

  const driverOptions: DominoFieldOption[] = [
    { label: 'PostgreSQL', value: 'postgres' },
    { label: 'MySQL', value: 'mysql' },
    { label: 'SQL Server', value: 'mssql' },
  ];

  // When the Connect button is clicked, reveal the Connection Name field
  const handleClick = () => {
    setConnected(true);
  };

  // Update the node details whenever query or connected state changes
  useEffect(() => {
    if (!data.setNodes) return;
    data.setNodes((nodes: any[]) =>
      nodes.map((n) => {
        if (n.id !== id) return n;
        const fields: DominoField[] = [
          {
            type: 'textArea',
            heading: 'Query',
            value: query,
            required: true,
            placeholder: 'SELECT * FROM table WHERE ...',
            shouldRender: true,
          },
          {
            type: 'button',
            label: 'Connect',
            onClick: handleClick,
            value: '',
            required: true,
            shouldRender: true,
          },
        ];

        if (connected) {
          fields.push({
            type: 'text',
            heading: 'Connection Name',
            value: 'query_connection',
            required: true,
            shouldRender: true,
          });
        }

        const details: DominoNodeData = {
          type: 'SQLRunner',
          description: 'Run a SQL query against an existing database connection',
          fields,
        };

        return {
          ...n,
          data: {
            ...n.data,
            details,
            exportFields: ['Query'],
          },
        };
      })
    );
  }, [data.setNodes, id, query, connected]);

  // Attach setter to update query value
  useEffect(() => {
    if (!data.setFieldValue && data.setNodes) {
      const setFieldValue = (heading: string, newValue: any) => {
        if (heading === 'Query') {
          setQuery(newValue);
        }
        data.setNodes!((nodes: any[]) =>
          nodes.map((n) => {
            if (n.id !== id) return n;
            return {
              ...n,
              data: {
                ...n.data,
                details: {
                  ...n.data.details,
                  fields: n.data.details.fields.map((f: DominoField) =>
                    f.heading === heading ? { ...f, value: newValue } : f
                  ),
                },
              },
            };
          })
        );
      };

      data.setNodes!((nodes: any[]) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, setFieldValue } } : n
        )
      );
    }
  }, [data.setNodes, data.setFieldValue, id]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    data.setFieldValue?.('Query', e.target.value);
  };

  // Run button handler
  const handleRun = () => {
    data.setFieldValue?.('Run', true);
  };

  return (
    <div
      style={{ minWidth: '14rem' }}
      className={`transition-all duration-150 rounded-md overflow-visible shadow-sm w-56
        ${hasError ? 'error-border' : selected ? 'selected-border' : 'unselected-border dark:border-gray-600'}
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header with Exec pins */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{ backgroundColor: '#10b981', borderBottomColor: '#059669' }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">SQL Runner</span>
        </div>
        <div className="flex items-center gap-1">
          <DominoPin id="exec_out_success" pinType={PinType.EXEC_OUT} inline />
          <DominoPin id="exec_out_error" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      {/* Details: Query textarea */}
      <div className="px-3 py-2 relative">
        <label className="block text-xs mb-1">Query</label>
        <textarea
          name="Query"
          value={query}
          onChange={handleChange}
          placeholder="SELECT * FROM ..."
          rows={4}
          className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text resize-none"
        />
      </div>

      {/* Value Out pin for result set */}
      <div className="flex justify-center py-2">
        <DominoPin id="value_out_Result" pinType={PinType.VALUE_OUT} inline />
      </div>

      {hasError && (
        <p className="mt-1 text-xs text-red-500 px-3">
          ⚠️ Query failed or connection missing.
        </p>
      )}
    </div>
  );
}
