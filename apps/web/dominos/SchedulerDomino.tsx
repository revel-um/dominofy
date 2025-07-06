import { NodeProps } from 'reactflow';
import { useEffect, useState } from 'react';
import { FiClock, FiPlay } from 'react-icons/fi';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

interface ScheduleConfig {
  cronExpression: string;
  timeZone: string;
  lastRun: Date | null;
  nextRun: Date | null;
}

export default function SchedulerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    cronExpression: '0 9 * * *', // Default: 9 AM daily
    timeZone: 'UTC',
    lastRun: null,
    nextRun: null
  });

  // Expose raw data for details panel
  useEffect(() => {
    if (!data.setRawData) return;
    
    data.setRawData({
      cronExpression: schedule.cronExpression,
      timeZone: schedule.timeZone,
      lastRun: schedule.lastRun?.toISOString() || 'Never',
      nextRun: schedule.nextRun?.toISOString() || 'Not scheduled'
    });
  }, [data, schedule]);

  // Initialize node data
  useEffect(() => {
    if (!data.setFieldValue || !data.details) return;

    const setFieldValue = (heading: string, value: any) => {
      setSchedule(prev => {
        const newSchedule = { ...prev, [heading.toLowerCase()]: value };
        return newSchedule;
      });
      
      // Update node data
      data.setNodes?.((nodes: any[]) =>
        nodes.map((n: any) =>
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

    data.setFieldValue = setFieldValue;

    // Initialize node data if not present
    if (!data.details.fields) {
      data.setNodes?.((nodes: any[]) =>
        nodes.map((n: any) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  details: {
                    ...n.data.details,
                    type: 'Scheduler',
                    description: 'Schedule pipelines to run on cron expressions',
                    fields: [
                      {
                        type: 'textInput',
                        heading: 'Cron Expression',
                        value: schedule.cronExpression,
                        required: true,
                        placeholder: '0 9 * * * (every day at 9 AM)',
                        description: 'Cron expression for scheduling',
                      },
                      {
                        type: 'select',
                        heading: 'Time Zone',
                        value: schedule.timeZone,
                        required: true,
                        options: [
                          { label: 'UTC', value: 'UTC' },
                          { label: 'Local Time', value: 'local' },
                          { label: 'Asia/Kolkata', value: 'Asia/Kolkata' },
                          { label: 'America/New_York', value: 'America/New_York' },
                          { label: 'Europe/London', value: 'Europe/London' }
                        ]
                      }
                    ],
                  },
                  exportFields: ['Cron Expression', 'Time Zone'],
                },
              }
            : n
        )
      );
    }
  }, [data, id]);

  // Handle field changes
  const handleFieldChange = (field: keyof ScheduleConfig, value: string) => {
    setSchedule(prev => ({
      ...prev,
      [field]: value
    }));
    
    const fieldName = field === 'cronExpression' ? 'Cron Expression' : 'Time Zone';
    data.setFieldValue?.(fieldName, value);
    clearValidationForDominoId(id);
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
          <FiClock className="w-4 h-4" />
          <span>Scheduler</span>
        </div>
        <div className="flex items-center pr-2">
          <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-3 p-3">
        {/* Cron Expression */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Cron Expression
          </label>
          <div className="relative">
            <input
              type="text"
              value={schedule.cronExpression}
              onChange={(e) => handleFieldChange('cronExpression', e.target.value)}
              placeholder="0 9 * * *"
              className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {schedule.cronExpression || 'e.g., 0 9 * * * for 9 AM daily'}
          </p>
        </div>

        {/* Time Zone */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Time Zone
          </label>
          <select
            value={schedule.timeZone}
            onChange={(e) => handleFieldChange('timeZone', e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          >
            <option value="UTC">UTC</option>
            <option value="local">Local Time</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
          </select>
        </div>

        {/* Schedule Info */}
        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Last Run:</span>
            <span className="font-mono">{formatDate(schedule.lastRun)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Next Run:</span>
            <span className="font-mono">
              {schedule.nextRun ? formatDate(schedule.nextRun) : 'Not scheduled'}
            </span>
          </div>
        </div>

        {/* Test Button */}
        <button
          onClick={() => {
            // This would trigger the schedule manually for testing
            setSchedule(prev => ({
              ...prev,
              lastRun: new Date()
            }));
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 mt-2 text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          <FiPlay className="w-3 h-3" />
          Test Schedule
        </button>
      </div>
    </div>
  );
}
