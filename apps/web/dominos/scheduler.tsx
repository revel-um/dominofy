import { NodeProps } from 'reactflow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FiClock } from 'react-icons/fi';
import { CalendarClock, Clock3, Globe2, ShieldCheck } from 'lucide-react';
import DominoPin from '../components/shared/dominoPin';
import DominoDropdown from '../components/shared/dominoDropdown';
import { PinType } from '../types/pinTypes';
import { useDomino } from '../contexts/dominoContext';
import dominoCatalog from './dominos';

type Frequency = 'once' | 'minute' | 'hour' | 'day' | 'week' | 'month';

interface ScheduleConfig {
  frequency: Frequency;
  interval: number;
  time: string;
  daysOfWeek: number[];
  timeZone: string;
  isActive: boolean;
}

const BROWSER_TIME_ZONE =
  typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    : 'UTC';

const normalizeScheduleTimeZone = (value: unknown): string => {
  if (typeof value !== 'string') return BROWSER_TIME_ZONE;
  const tz = value.trim();
  if (!tz || tz.toLowerCase() === 'local') return BROWSER_TIME_ZONE;
  return tz;
};

const DEFAULT_SCHEDULE: ScheduleConfig = {
  frequency: 'day',
  interval: 1,
  time: '09:00',
  daysOfWeek: [1, 2, 3, 4, 5], // Default: Weekdays
  timeZone: BROWSER_TIME_ZONE,
  isActive: true,
};

const schedulesEqual = (a: ScheduleConfig, b: ScheduleConfig) =>
  a.frequency === b.frequency &&
  a.interval === b.interval &&
  a.time === b.time &&
  a.timeZone === b.timeZone &&
  a.isActive === b.isActive &&
  a.daysOfWeek.length === b.daysOfWeek.length &&
  a.daysOfWeek.every((d, i) => d === b.daysOfWeek[i]);

export default function SchedulerDomino({ data, id, selected }: NodeProps) {
  const { erroredNodes, clearValidationForDominoId } = useDomino();
  const hasError = erroredNodes.includes(id);
  const { setNodes: incomingSetNodes, setFieldValue: incomingSetFieldValue, setRawData: incomingSetRawData } = data;

  const setNodesRef = useRef(incomingSetNodes);
  const setFieldValueRef = useRef(incomingSetFieldValue);
  const setRawDataRef = useRef(incomingSetRawData);
  useEffect(() => {
    setNodesRef.current = incomingSetNodes;
  }, [incomingSetNodes]);
  useEffect(() => {
    setFieldValueRef.current = incomingSetFieldValue;
  }, [incomingSetFieldValue]);
  useEffect(() => {
    setRawDataRef.current = incomingSetRawData;
  }, [incomingSetRawData]);

  const schedulerMeta = dominoCatalog.find((entry) => entry.id === 'SchedulerDomino');
  const schedulerAccentColor = schedulerMeta?.badgeStyle?.background
    ? String(schedulerMeta.badgeStyle.background).match(/#[0-9a-fA-F]{6}/)?.[0]
    : '#0ea5e9';

  const [schedule, setSchedule] = useState<ScheduleConfig>(() => ({
    ...DEFAULT_SCHEDULE,
    daysOfWeek: [...DEFAULT_SCHEDULE.daysOfWeek],
  }));

  // Update node fields in the React Flow graph
  const updateNodeFields = useCallback((updatedSchedule: ScheduleConfig) => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    const updatedFields = [
      {
        type: 'checkbox',
        heading: 'Active',
        value: updatedSchedule.isActive,
        inPinId: 'value_in',
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

    setNodes((nodes: any[]) =>
      nodes.map((n: any) => {
        if (n.id !== id) return n;
        const existing = n.data.details?.fields ?? [];
        const same =
          existing.length === updatedFields.length &&
          existing.every((f: any, idx: number) => JSON.stringify(f) === JSON.stringify(updatedFields[idx]));
        if (same) return n;

        return {
          ...n,
          data: {
            ...n.data,
            details: { ...n.data.details, fields: updatedFields },
            exportFields: ['Active', 'Frequency', 'Interval', 'Time', 'Days of Week', 'Time Zone'],
          },
        };
      })
    );
  }, [id]);

  // Initialize node data on mount
  useEffect(() => {
    const setNodes = setNodesRef.current;
    if (!setNodes) return;

    // Only initialize if fields don't exist yet
    if (!data.details?.fields || data.details.fields.length === 0) {
      const initialFields = [
        {
          type: 'checkbox',
          heading: 'Active',
          value: schedule.isActive,
          inPinId: 'value_in',
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

      setNodes((nodes: any[]) =>
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

      const frequency = getFieldValue('Frequency', DEFAULT_SCHEDULE.frequency) as Frequency;
      const interval = parseInt(getFieldValue('Interval', DEFAULT_SCHEDULE.interval), 10);
      const time = getFieldValue('Time', DEFAULT_SCHEDULE.time);
      const daysOfWeek = getFieldValue('Days of Week', DEFAULT_SCHEDULE.daysOfWeek.join(','))
        .split(',')
        .filter(Boolean)
        .map(Number);
      const timeZone = normalizeScheduleTimeZone(getFieldValue('Time Zone', DEFAULT_SCHEDULE.timeZone));
      const isActiveRaw = getFieldValue('Active', DEFAULT_SCHEDULE.isActive);
      const isActive = typeof isActiveRaw === 'string' ? isActiveRaw === 'true' || isActiveRaw === '1' : Boolean(isActiveRaw);

      const next: ScheduleConfig = {
        ...DEFAULT_SCHEDULE,
        frequency,
        interval,
        time,
        daysOfWeek: daysOfWeek.length ? daysOfWeek : DEFAULT_SCHEDULE.daysOfWeek,
        timeZone,
        isActive,
      };

      setSchedule(prev => (schedulesEqual(prev, next) ? prev : next));
    }
  }, [data.details?.fields, id]);

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
    const setFieldValue = setFieldValueRef.current;
    if (!setFieldValue) return;
    
    setFieldValue('Frequency', schedule.frequency);
    setFieldValue('Interval', schedule.interval);
    setFieldValue('Time', schedule.time);
    setFieldValue('DaysOfWeek', schedule.daysOfWeek);
    setFieldValue('Time Zone', schedule.timeZone);
    setFieldValue('Active', schedule.isActive);
  }, [schedule]);

  // Expose raw data for details panel
  useEffect(() => {
    const setRawData = setRawDataRef.current;
    if (!setRawData) return;
    
    setRawData({
      frequency: schedule.frequency,
      interval: schedule.interval,
      time: schedule.time,
      daysOfWeek: schedule.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]),
      timeZone: schedule.timeZone,
      active: schedule.isActive ? 'Active' : 'Inactive',
    });
  }, [schedule]);

  // Initialize node data
  useEffect(() => {
    const setFieldValue = setFieldValueRef.current;
    if (!setFieldValue || !data.details) return;

    const hasFrequency = data.details['Frequency'] !== undefined;
    if (!hasFrequency) return;

    const parsedDays = Array.isArray(data.details['DaysOfWeek'])
      ? data.details['DaysOfWeek']
      : DEFAULT_SCHEDULE.daysOfWeek;

    setSchedule((prev) => {
      const next: ScheduleConfig = {
        ...prev,
        frequency: data.details['Frequency'] || DEFAULT_SCHEDULE.frequency,
        interval: data.details['Interval'] || DEFAULT_SCHEDULE.interval,
        time: data.details['Time'] || DEFAULT_SCHEDULE.time,
        daysOfWeek: parsedDays,
        timeZone: normalizeScheduleTimeZone(data.details['Time Zone'] || DEFAULT_SCHEDULE.timeZone),
        isActive: data.details['Active'] ?? DEFAULT_SCHEDULE.isActive,
      };
      return schedulesEqual(prev, next) ? prev : next;
    });
  }, [data.details]);

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

  const handleFrequencyChange = (newFrequency: Frequency) => {
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
      className={`group/node relative w-[21rem] overflow-visible rounded-xl border bg-dominofy-light-panel/95 shadow-sm backdrop-blur transition-all duration-150 dark:bg-dominofy-dark-panel/95 ${
        hasError
          ? 'error-border'
          : selected
            ? 'selected-border border-4 shadow-xl ring-2 ring-primary/50'
            : 'unselected-border dark:border-gray-600'
      } hover:shadow-lg`}
      style={{ minWidth: '21rem', maxWidth: '21rem' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/node:opacity-100" />

      <div className="relative rounded-t-xl border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-10">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur"
              style={{
                borderColor: schedulerAccentColor,
                backgroundColor: `${schedulerAccentColor}22`,
              }}
            >
              <FiClock className="h-4 w-4" style={{ color: schedulerAccentColor }} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                Scheduler
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Trigger
              </div>
            </div>
          </div>
          <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-end pr-3">
            <DominoPin id="exec_out" pinType={PinType.EXEC_OUT} inline />
          </div>
        </div>
      </div>

      <div className="relative space-y-4 px-4 py-4">
        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
                Schedule Summary
              </div>
              <div className="mt-1 text-sm font-medium text-foreground/80 dark:text-slate-200">
                {getScheduleDescription()}
              </div>
            </div>
            <span className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
              {schedule.isActive ? 'Active' : 'Paused'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Trigger State
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {schedule.isActive ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 dark:border-slate-600 dark:bg-dominofy-dark-surface">
            <div>
              <div className="text-sm font-medium text-foreground dark:text-slate-200">Active</div>
              <div className="mt-0.5 text-xs text-foreground/55 dark:text-slate-400">
                Emit scheduled runs when enabled
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground/60 dark:text-slate-300">
                {schedule.isActive ? 'On' : 'Off'}
              </span>
              <input
                type="checkbox"
                checked={schedule.isActive}
                onChange={handleActiveChange}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
              />
            </div>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <CalendarClock className="h-3.5 w-3.5" />
              Cadence
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {frequencyOptions.find((option) => option.value === schedule.frequency)?.label ?? 'Days'}
            </span>
          </div>

          <DominoDropdown
            value={schedule.frequency}
            onChange={(nextValue) => handleFrequencyChange(nextValue as Frequency)}
            options={[
              { label: 'Once', value: 'once' },
              { label: 'Every X Minutes', value: 'minute' },
              { label: 'Every X Hours', value: 'hour' },
              { label: 'Daily', value: 'day' },
              { label: 'Weekly', value: 'week' },
              { label: 'Monthly', value: 'month' },
            ]}
          />
        </div>

        {(schedule.frequency === 'minute' || schedule.frequency === 'hour') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Clock3 className="h-3.5 w-3.5" />
                Interval
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                {schedule.frequency === 'minute' ? 'Minutes' : 'Hours'}
              </span>
            </div>

            <div className="min-h-12 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={schedule.interval}
                onChange={handleIntervalChange}
                className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none dark:text-dominofy-dark-text"
              />
            </div>
            <div className="text-xs text-foreground/55 dark:text-slate-400">
              {schedule.frequency === 'minute'
                ? 'Allowed range is 1 to 59 minutes'
                : 'Allowed range is 1 to 23 hours'}
            </div>
          </div>
        )}

        {(schedule.frequency === 'day' || schedule.frequency === 'week' || schedule.frequency === 'month') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <Clock3 className="h-3.5 w-3.5" />
                Time
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Local schedule time
              </span>
            </div>
            <div className="min-h-12 rounded-lg border border-slate-300/80 bg-dominofy-light-surface transition focus-within:border-slate-900/30 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:focus-within:border-slate-300/40 dark:focus-within:ring-slate-200/10">
              <input
                type="time"
                value={schedule.time}
                onChange={handleTimeChange}
                className="nodrag h-full min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-sm text-dominofy-light-text outline-none dark:text-dominofy-dark-text dark:[color-scheme:dark]"
              />
            </div>
          </div>
        )}

        {schedule.frequency === 'week' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
                <CalendarClock className="h-3.5 w-3.5" />
                Days
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
                Weekly selection
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {dayOptions.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDayOfWeek(day.value)}
                  className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                    schedule.daysOfWeek.includes(day.value)
                      ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                      : 'bg-dominofy-light-surface text-foreground/70 dark:bg-dominofy-dark-surface dark:text-slate-300'
                  }`}
                >
                  {day.label.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <Globe2 className="h-3.5 w-3.5" />
              Time Zone
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              {schedule.timeZone}
            </span>
          </div>
          <DominoDropdown
            value={schedule.timeZone}
            onChange={(nextValue) => handleFieldChange('timeZone', nextValue)}
            options={[
              { label: 'UTC', value: 'UTC' },
              { label: `Local Time (${BROWSER_TIME_ZONE})`, value: BROWSER_TIME_ZONE },
              { label: 'Asia/Kolkata', value: 'Asia/Kolkata' },
              { label: 'America/New York', value: 'America/New_York' },
              { label: 'Europe/London', value: 'Europe/London' },
            ]}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 dark:bg-white/10 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Output
            </div>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/50 dark:text-slate-400">
              Scheduled exec
            </span>
          </div>
          <div className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
              Output
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground/75 dark:text-slate-300">
              Emits an execution signal whenever the schedule fires
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
