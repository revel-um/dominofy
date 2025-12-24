import { NodeProps } from 'reactflow';
import { useCallback, useEffect, useState } from 'react';
import { FiClock, FiPlay } from 'react-icons/fi';
import DominoPin from '../components/shared/dominoPin';
import { PinType } from '../types/pinTypes';
import { DominoField } from '../types/dominoFieldTypes';
import { useDomino } from '../contexts/dominoContext';

type Frequency = 'once' | 'minute' | 'hour' | 'day' | 'week' | 'month';

type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

interface ScheduleConfig {
  frequency: Frequency;
  interval: number;
  time: string;
  daysOfWeek: number[];
  lastRun: Date | null;
  nextRun: Date | null;
  timeZone: string;
  isActive: boolean;
}

export default function SchedulerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    frequency: 'day',
    interval: 1,
    time: '09:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Default: Weekdays
    lastRun: null,
    nextRun: null,
    timeZone: 'local',
    isActive: true,
  });

  // Update node fields in the React Flow graph
  const updateNodeFields = useCallback((updatedSchedule: ScheduleConfig) => {
    if (!data.setNodes) return;

    const updatedFields = [
      {
        type: 'checkbox',
        heading: 'Active',
        value: updatedSchedule.isActive,
        inPinId: 'value_in_active',
        required: false,
        shouldRender: true,
      },
      {
        type: 'select',
        heading: 'Frequency',
        value: updatedSchedule.frequency,
        options: [
          { label: 'Once', value: 'once' },
          { label: 'Minutes', value: 'minute' },
          { label: 'Hours', value: 'hour' },
          { label: 'Days', value: 'day' },
          { label: 'Weeks', value: 'week' },
          { label: 'Months', value: 'month' },
        ],
        inPinId: 'value_in_1',
        required: true,
        shouldRender: true,
      },
      {
        type: 'number',
        heading: 'Interval',
        value: updatedSchedule.interval,
        inPinId: 'value_in_2',
        required: true,
        shouldRender: true,
      },
      {
        type: 'time',
        heading: 'Time',
        value: updatedSchedule.time,
        inPinId: 'value_in_3',
        required: true,
        shouldRender: updatedSchedule.frequency !== 'minute' && updatedSchedule.frequency !== 'hour',
      },
      {
        type: 'select',
        heading: 'Days of Week',
        value: updatedSchedule.daysOfWeek.join(','),
        options: [
          { label: 'Sunday', value: '0' },
          { label: 'Monday', value: '1' },
          { label: 'Tuesday', value: '2' },
          { label: 'Wednesday', value: '3' },
          { label: 'Thursday', value: '4' },
          { label: 'Friday', value: '5' },
          { label: 'Saturday', value: '6' },
        ],
        inPinId: 'value_in_4',
        required: false,
        multiple: true,
        shouldRender: updatedSchedule.frequency === 'week',
      },
      {
        type: 'text',
        heading: 'Time Zone',
        value: updatedSchedule.timeZone,
        inPinId: 'value_in_5',
        required: false,
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
              exportFields: ['Active', 'Frequency', 'Interval', 'Time', 'Days of Week', 'Time Zone'],
            },
          }
          : n
      )
    );
  }, [data.setNodes, id]);

  // Initialize node data on mount
  useEffect(() => {
    if (!data.setNodes) return;

    // Only initialize if fields don't exist yet
    if (!data.details?.fields || data.details.fields.length === 0) {
      const initialFields = [
        {
          type: 'checkbox',
          heading: 'Active',
          value: schedule.isActive,
          inPinId: 'value_in_active',
          required: false,
          shouldRender: true,
        },
        {
          type: 'select',
          heading: 'Frequency',
          value: schedule.frequency,
          options: [
            { label: 'Once', value: 'once' },
            { label: 'Minutes', value: 'minute' },
            { label: 'Hours', value: 'hour' },
            { label: 'Days', value: 'day' },
            { label: 'Weeks', value: 'week' },
            { label: 'Months', value: 'month' },
          ],
          inPinId: 'value_in_1',
          required: true,
          shouldRender: true,
        },
        {
          type: 'number',
          heading: 'Interval',
          value: schedule.interval,
          inPinId: 'value_in_2',
          required: true,
          shouldRender: true,
        },
        {
          type: 'time',
          heading: 'Time',
          value: schedule.time,
          inPinId: 'value_in_3',
          required: true,
          shouldRender: schedule.frequency !== 'minute' && schedule.frequency !== 'hour',
        },
        {
          type: 'select',
          heading: 'Days of Week',
          value: schedule.daysOfWeek.join(','),
          options: [
            { label: 'Sunday', value: '0' },
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
          ],
          inPinId: 'value_in_4',
          required: false,
          multiple: true,
          shouldRender: schedule.frequency === 'week',
        },
        {
          type: 'text',
          heading: 'Time Zone',
          value: schedule.timeZone,
          inPinId: 'value_in_5',
          required: false,
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
                details: { ...n.data.details, fields: initialFields },
                exportFields: ['Active', 'Frequency', 'Interval', 'Time', 'Days of Week', 'Time Zone'],
              },
            }
            : n
        )
      );
    } else {
      // Update local state from existing node data
      const fields = data.details.fields || [];
      const getFieldValue = (heading: string, defaultValue: any) => 
        fields.find((f: any) => f.heading === heading)?.value ?? defaultValue;

      const frequency = getFieldValue('Frequency', schedule.frequency) as Frequency;
      const interval = parseInt(getFieldValue('Interval', schedule.interval), 10);
      const time = getFieldValue('Time', schedule.time);
      const daysOfWeek = getFieldValue('Days of Week', schedule.daysOfWeek.join(','))
        .split(',')
        .filter(Boolean)
        .map(Number);
      const timeZone = getFieldValue('Time Zone', schedule.timeZone);
      const isActiveRaw = getFieldValue('Active', schedule.isActive);
      const isActive = typeof isActiveRaw === 'string' ? isActiveRaw === 'true' || isActiveRaw === '1' : Boolean(isActiveRaw);

      setSchedule({
        frequency,
        interval,
        time,
        daysOfWeek: daysOfWeek.length ? daysOfWeek : schedule.daysOfWeek,
        lastRun: schedule.lastRun,
        nextRun: schedule.nextRun,
        timeZone,
        isActive,
      });
    }
  }, [data.setNodes, id]);

  const frequencyOptions = [
    { value: 'once', label: 'Once' },
    { value: 'minute', label: 'Minutes' },
    { value: 'hour', label: 'Hours' },
    { value: 'day', label: 'Days' },
    { value: 'week', label: 'Weeks' },
    { value: 'month', label: 'Months' }
  ];

  const dayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  // Sync schedule changes back to node data
  useEffect(() => {
    if (!data.setFieldValue) return;
    
    data.setFieldValue('Frequency', schedule.frequency);
    data.setFieldValue('Interval', schedule.interval);
    data.setFieldValue('Time', schedule.time);
    data.setFieldValue('DaysOfWeek', schedule.daysOfWeek);
    data.setFieldValue('Time Zone', schedule.timeZone);
    data.setFieldValue('Active', schedule.isActive);
  }, [data, schedule.frequency, schedule.interval, schedule.time, schedule.daysOfWeek, schedule.timeZone, schedule.isActive]);

  // Expose raw data for details panel
  useEffect(() => {
    if (!data.setRawData) return;
    
    data.setRawData({
      frequency: schedule.frequency,
      interval: schedule.interval,
      time: schedule.time,
      daysOfWeek: schedule.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]),
      timeZone: schedule.timeZone,
      lastRun: schedule.lastRun?.toISOString() || 'Never',
      nextRun: schedule.nextRun?.toISOString() || 'Not scheduled',
      active: schedule.isActive ? 'Active' : 'Inactive',
    });
  }, [data, schedule]);

  // Initialize node data
  useEffect(() => {
    if (!data.setFieldValue || !data.details) return;

    const setFieldValue = (heading: string, value: any) => {
      data.setFieldValue?.(heading, value);
      clearValidationForDominoId(id);
    };

    // Set initial values if they exist in node data
    if (data.details['Frequency']) {
      setSchedule(prev => ({
        ...prev,
        frequency: data.details['Frequency'] || 'day',
        interval: data.details['Interval'] || 1,
        time: data.details['Time'] || '09:00',
        daysOfWeek: data.details['DaysOfWeek'] || [1, 2, 3, 4, 5],
        timeZone: data.details['Time Zone'] || 'local',
        isActive: data.details['Active'] ?? true,
      }));
    }
  }, [data, id]);

  // Handle field changes
  const handleFieldChange = (field: keyof ScheduleConfig, value: any) => {
    const update: Partial<ScheduleConfig> = { [field]: value };
    
    // Special handling for daysOfWeek to ensure it's always an array
    if (field === 'daysOfWeek' && !Array.isArray(value)) {
      update.daysOfWeek = [value];
    }
    
    setSchedule(prev => ({
      ...prev,
      ...update
    }));

    updateNodeFields({ ...schedule, ...update });
    clearValidationForDominoId(id);
  };

  const handleActiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isActive = e.target.checked;
    const updatedSchedule = { ...schedule, isActive };
    setSchedule(updatedSchedule);
    updateNodeFields(updatedSchedule);
    clearValidationForDominoId(id);
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFrequency = e.target.value as Frequency;
    const updatedSchedule = {
      ...schedule,
      frequency: newFrequency,
      daysOfWeek: newFrequency === 'week' ? schedule.daysOfWeek : []
    };

    setSchedule(updatedSchedule);
    updateNodeFields(updatedSchedule);
    clearValidationForDominoId(id);
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Reject non-digits (blocks floats/decimals) to enforce whole numbers only
    if (!/^\d*$/.test(raw)) return;

    const maxAllowed = schedule.frequency === 'minute' ? 59 : 23;
    const parsed = raw === '' ? 1 : parseInt(raw, 10);
    const interval = Math.min(maxAllowed, Math.max(1, parsed));
    const updatedSchedule = { ...schedule, interval };
    setSchedule(updatedSchedule);
    updateNodeFields(updatedSchedule);
    clearValidationForDominoId(id);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updatedSchedule = { ...schedule, time: e.target.value };
    setSchedule(updatedSchedule);
    updateNodeFields(updatedSchedule);
    clearValidationForDominoId(id);
  };

  const handleDayToggle = (day: number) => {
    const days = [...schedule.daysOfWeek];
    const index = days.indexOf(day);
    if (index === -1) {
      days.push(day);
    } else if (days.length > 1) { // Ensure at least one day is selected
      days.splice(index, 1);
    }
    const updatedSchedule = { ...schedule, daysOfWeek: days.sort((a, b) => a - b) };
    setSchedule(updatedSchedule);
    updateNodeFields(updatedSchedule);
    clearValidationForDominoId(id);
  };

  // Alias for toggleDayOfWeek to maintain compatibility with existing code
  const toggleDayOfWeek = handleDayToggle;

  // Format date for display
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  // Convert schedule to human-readable format
  const getScheduleDescription = () => {
    if (!schedule.isActive) return 'Scheduler inactive';

    const { frequency, interval, time, daysOfWeek } = schedule;
    const timeStr = new Date(`2000-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    switch (frequency) {
      case 'once':
        return `Run once at ${timeStr} on ${new Date().toLocaleDateString()}`;
      case 'minute':
        return `Every ${interval > 1 ? `${interval} minutes` : 'minute'}`;
      case 'hour':
        return `Every ${interval > 1 ? `${interval} hours` : 'hour'}`;
      case 'day':
        return `Daily at ${timeStr}`;
      case 'week':
        const days = daysOfWeek.map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ');
        return `Weekly on ${days} at ${timeStr}`;
      case 'month':
        return `Monthly on day ${new Date().getDate()} at ${timeStr}`;
      default:
        return 'Custom schedule';
    }
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
        className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white border-b rounded-t-md relative"
        style={{
          backgroundColor: '#8b5cf6',
          borderBottomColor: '#7c3aed',
          borderRadius: '0.23rem 0.23rem 0 0',
        }}
      >
        <div className="flex items-center gap-1">
          <FiClock className="w-4 h-4" />
          <span className="truncate">Scheduler</span>
        </div>
        <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
      </div>

      {/* Form fields */}
      <div className="space-y-3 p-3">
        {/* Active toggle */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Active</span>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={schedule.isActive}
              onChange={handleActiveChange}
              className="w-4 h-4"
            />
            <span className="text-xs text-gray-600 dark:text-gray-300">{schedule.isActive ? 'On' : 'Off'}</span>
          </label>
        </div>

        {/* Schedule Preview */}
        <div className="p-2 mb-2 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
          {getScheduleDescription()}
        </div>

        {/* Frequency */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Frequency
          </label>
          <select
            value={schedule.frequency}
            onChange={handleFrequencyChange}
            className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
          >
            <option value="once">Once</option>
            <option value="minute">Every X Minutes</option>
            <option value="hour">Every X Hours</option>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>

        {/* Interval (for minute/hour frequencies) */}
        {(schedule.frequency === 'minute' || schedule.frequency === 'hour') && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              {schedule.frequency === 'minute' ? 'Minutes' : 'Hours'} between runs
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={schedule.interval}
              onChange={handleIntervalChange}
              className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          </div>
        )}

        {/* Time of day (for day/week/month frequencies) */}
        {(schedule.frequency === 'day' || schedule.frequency === 'week' || schedule.frequency === 'month') && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Time
            </label>
            <input
              type="time"
              value={schedule.time}
              onChange={handleTimeChange}
              className="w-full px-2 py-1 text-sm border rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-dominofy-light-text dark:text-dominofy-dark-text"
            />
          </div>
        )}

        {/* Days of week (for weekly frequency) */}
        {schedule.frequency === 'week' && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Days
            </label>
            <div className="grid grid-cols-4 gap-1">
              {dayOptions.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDayOfWeek(day.value)}
                  className={`py-1 text-xs text-center rounded ${
                    schedule.daysOfWeek.includes(day.value)
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  {day.label.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}

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
            <option value="America/New_York">America/New York</option>
            <option value="Europe/London">Europe/London</option>
          </select>
        </div>

        {/* Last Run / Next Run */}
        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Last run: {formatDate(schedule.lastRun)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Next run: {formatDate(schedule.nextRun)}
          </div>
        </div>
      </div>
    </div>
  );
}
