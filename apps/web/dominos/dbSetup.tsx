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

export default function DatabaseDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes } = useDomino();
  const hasError = erroredNodes.includes(id);

  const driverOptions: DominoFieldOption[] = [
    { label: 'PostgreSQL', value: 'postgres' },
    { label: 'MySQL', value: 'mysql' },
    { label: 'SQL Server', value: 'mssql' },
  ];
  const sslOptions: DominoFieldOption[] = [
    { label: 'disable', value: 'disable' },
    { label: 'require', value: 'require' },
  ];

  // Central local state
  const [values, setValues] = useState({
    Driver: 'postgres',
    Host: 'localhost',
    Port: '5432',
    Username: '',
    Password: '',
    Database: '',
    Timeout: '5000',
    SSL: 'disable',
  });

  // 1️⃣ On mount only: bootstrap fields if missing
  useEffect(() => {
    if (data.setNodes && !data.details) {
      data.setNodes((nodes: any[]) =>
        nodes.map((n) => {
          if (n.id !== id) return n;
          const details: DominoNodeData = {
            type: 'DatabaseConnect',
            description: 'Connect to a relational database',
            fields: [
              {
                type: 'dropdown',
                heading: 'Driver',
                value: values.Driver,
                options: driverOptions,
                required: true,
                placeholder: 'Select driver',
                inPinId: `value_in_1`,
              },
              {
                type: 'textInput',
                heading: 'Host',
                value: values.Host,
                required: true,
                placeholder: 'localhost',
                inPinId: `value_in_2`,
              },
              {
                type: 'textInput',
                heading: 'Port',
                value: values.Port,
                required: true,
                placeholder: '5432',
                inPinId: `value_in_3`,
              },
              {
                type: 'textInput',
                heading: 'Username',
                value: values.Username,
                required: true,
                inPinId: `value_in_4`,
              },
              {
                type: 'password',
                heading: 'Password',
                value: values.Password,
                required: true,
                inPinId: `value_in_5`,
              },
              {
                type: 'textInput',
                heading: 'Database',
                value: values.Database,
                required: true,
                placeholder: 'DB name',
                inPinId: `value_in_6`,
              },
              {
                type: 'textInput',
                heading: 'Timeout',
                value: values.Timeout,
                required: false,
                placeholder: 'ms',
                inPinId: `value_in_7`,
              },
              {
                type: 'dropdown',
                heading: 'SSL',
                value: values.SSL,
                options: sslOptions,
                required: false,
                placeholder: 'SSL mode',
                inPinId: `value_in_8`,
              },
            ],
          };
          return {
            ...n,
            data: {
              ...n.data,
              details,
              exportFields: Object.keys(values),
            },
          };
        })
      );
    }
  }, [data.setNodes, id]);

  // 2️⃣ Always: attach a setter that writes back into details.fields
  useEffect(() => {
    if (!data.setFieldValue && data.setNodes) {
      const setFieldValue = (heading: string, newValue: any) => {
        // update local
        setValues((prev) => ({ ...prev, [heading]: newValue }));
        // update details.fields on the node
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

      // write that into data for your panel & child fields to call
      data.setNodes!((nodes: any[]) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, setFieldValue } } : n
        )
      );
    }
  }, [data.setNodes, data.setFieldValue, id]);

  // 3️⃣ Mirror any external changes into local state
  useEffect(() => {
    data.details?.fields?.forEach((f: DominoField) => {
      if (f.value !== values[f.heading as keyof typeof values]) {
        setValues((prev) => ({ ...prev, [f.heading as any]: f.value }));
      }
    });
  }, [data.details?.fields]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    // call into your injected setter
    data.setFieldValue?.(name, value);
  };

  return (
    <div
      style={{ minWidth: '13rem' }}
      className={`transition-all duration-150 rounded-md w-56 overflow-visible shadow-sm
        ${hasError
          ? 'error-border'
          : selected
            ? 'selected-border'
            : 'unselected-border dark:border-gray-600'
        }
        bg-dominofy-light-panel dark:bg-dominofy-dark-panel`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#6366f1',
          borderBottomColor: '#059669',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <DominoPin id="exec_in" pinType={PinType.EXEC_IN} inline />
          <span className="truncate">Database Connect</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>
      
      {data.details?.fields.map((field: DominoField, idx: number) => {
        if (field.type === 'dropdown') {
          return (
            <div className="px-3 py-2 flex items-center gap-2 relative" key={field.heading} >
              <label className="block text-xs mb-1">{field.heading}</label>
              <DominoPin id={`value_in_${idx+1}`} pinType={PinType.VALUE_IN} inline />
                <select
                  name={field.heading}
                  value={values[field.heading as keyof typeof values]}
                  onChange={handleChange}
                  className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
                >
                  {(field.options || []).map((opt: DominoFieldOption) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
          );
        } else {
          return (
            <>
            <div className="px-3 py-2 flex items-center gap-2 relative" key={field.heading}>
              <label className="block text-xs mb-1">{field.heading}</label>
               
                <DominoPin id={`value_in_${idx+1}`} pinType={PinType.VALUE_IN} inline />      
            </div>
            <div className="px-3">
              <input
                type={field.type === 'password' ? 'password' : 'text'}
                name={field.heading}
                value={values[field.heading as keyof typeof values]}
                placeholder={field.placeholder}
                onChange={handleChange}
                className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
              />
            </div>
                
            </>
          );
        }
      })}

      {hasError && (
        <p className="mt-1 text-xs text-red-500 px-3">
          ⚠️ Connection parameters missing or invalid.
        </p>
      )}
    </div>
  );
}
