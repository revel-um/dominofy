'use client';

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { JsonInput } from '@/components/widgets/jsonInput';

export type TriggerType =
  | 'apitrigger'
  | 'emailtrigger'
  | 'slacktrigger'
  | 'SchedulerDomino'
  | 'googleCalendarEventCreated'
  | 'googleCalendarEventUpdated';

type TriggerNodeConfig = {
  id: string;
  type: TriggerType;
  data?: Record<string, any>;
};

type MockFile = {
  originalname: string;
  mimetype: string;
  size: number;
  bufferBase64: string;
};

interface Props {
  trigger: TriggerNodeConfig;
  onRun: (mockInput: Record<string, any>) => void | Promise<void>;
  onClose: () => void;
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  apitrigger: 'API Trigger',
  emailtrigger: 'Email Trigger',
  slacktrigger: 'Slack Trigger',
  SchedulerDomino: 'Scheduler Trigger',
  googleCalendarEventCreated: 'Google Calendar Event Created',
  googleCalendarEventUpdated: 'Google Calendar Event Updated',
};

async function fileToMock(file: File): Promise<MockFile> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return {
    originalname: file.name,
    mimetype: file.type || 'application/octet-stream',
    size: file.size,
    bufferBase64: btoa(binary),
  };
}

function getApiTriggerFlags(trigger: TriggerNodeConfig) {
  const fields = trigger.data?.details?.fields ?? [];
  const findFlag = (heading: string) =>
    Boolean(fields.find((field: { heading?: string; value?: unknown }) => field.heading === heading)?.value);

  return {
    requireBody: findFlag('Require Body'),
    requireFile: findFlag('Require File Upload'),
  };
}

function buildCalendarEventPayload(
  triggerType: 'created' | 'updated',
  values: Record<string, string>,
) {
  const now = new Date().toISOString();
  const eventId = values.eventId || `evt_${Date.now()}`;
  const calendarId = values.calendarId || 'primary';
  const startDateTime = values.start ? new Date(values.start).toISOString() : now;
  const endDateTime = values.end
    ? new Date(values.end).toISOString()
    : new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const event = {
    id: eventId,
    status: values.status || 'confirmed',
    summary: values.summary,
    description: values.description || '',
    htmlLink:
      values.htmlLink ||
      `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(eventId)}`,
    location: values.location || '',
    start: { dateTime: startDateTime },
    end: { dateTime: endDateTime },
    created: now,
    updated: now,
    attendees: [],
    creator: { email: values.creatorEmail || 'creator@example.com' },
    organizer: { email: values.organizerEmail || 'organizer@example.com' },
  };

  return {
    triggerType,
    eventId,
    status: event.status,
    summary: event.summary,
    description: event.description,
    htmlLink: event.htmlLink,
    location: event.location,
    calendarId,
    start: event.start,
    end: event.end,
    created: event.created,
    updated: event.updated,
    attendees: event.attendees,
    creator: event.creator,
    organizer: event.organizer,
    event,
  };
}

export default function TriggerMockModal({ trigger, onRun, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [apiBody, setApiBody] = useState<Record<string, any>>({});
  const [apiBodyTouched, setApiBodyTouched] = useState(false);

  const label = TRIGGER_LABELS[trigger.type] ?? trigger.type;
  const apiFlags = useMemo(() => getApiTriggerFlags(trigger), [trigger]);

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === 'body' || key === 'blocks' || key === 'attachments') {
      setJsonError(null);
    }
  };

  const parseJson = (value: string, labelText: string) => {
    if (!value.trim()) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      setJsonError(`${labelText} must be valid JSON`);
      return null;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setJsonError(null);

    try {
      let mockInput: Record<string, any> = {};

      if (trigger.type === 'apitrigger') {
        if (apiFlags.requireBody) {
          mockInput.body = apiBodyTouched ? apiBody : {};
        } else if (apiBodyTouched) {
          mockInput.body = apiBody;
        }

        if (apiFlags.requireFile && file) {
          mockInput.file = await fileToMock(file);
        } else if (apiFlags.requireFile && !file) {
          setJsonError('File is required');
          return;
        }
      }

      if (trigger.type === 'emailtrigger') {
        const attachments = await Promise.all(emailAttachments.map((entry) => fileToMock(entry)));
        mockInput = {
          provider: 'gmail',
          vaultId: trigger.data?.vaultId || '',
          emailAddress: values.to || 'inbox@example.com',
          messageId: `msg_${Date.now()}`,
          threadId: `thread_${Date.now()}`,
          historyId: String(Date.now()),
          subject: values.subject || 'Mock email subject',
          from: values.from || 'sender@example.com',
          to: values.to || 'inbox@example.com',
          cc: values.cc || '',
          bcc: values.bcc || '',
          body: values.body || '',
          snippet: values.snippet || (values.body || '').slice(0, 120),
          internalDate: String(Date.now()),
          hasAttachments: attachments.length > 0,
          attachments: attachments.map((entry, index) => ({
            name: entry.originalname,
            mime: entry.mimetype,
            size: entry.size,
            bufferBase64: entry.bufferBase64,
            attachmentId: `attachment_${index + 1}`,
            partId: `${index + 1}`,
            contentId: undefined,
            contentDisposition: 'attachment',
          })),
        };
      }

      if (trigger.type === 'slacktrigger') {
        const blocks = parseJson(values.blocks ?? '', 'Blocks');
        if (blocks === null) return;
        const attachments = parseJson(values.attachments ?? '', 'Attachments');
        if (attachments === null) return;

        mockInput = {
          type: 'message',
          text: values.text || '',
          user: values.user || 'U12345678',
          channel: values.channel || trigger.data?.slackChannelId || 'C12345678',
          ts: values.ts || `${Math.floor(Date.now() / 1000)}.000100`,
          ...(values.thread_ts ? { thread_ts: values.thread_ts } : {}),
          ...(blocks ? { blocks } : {}),
          ...(attachments ? { attachments } : {}),
        };
      }

      if (trigger.type === 'SchedulerDomino') {
        mockInput = {
          triggeredAt: new Date().toISOString(),
        };
      }

      if (trigger.type === 'googleCalendarEventCreated') {
        mockInput = buildCalendarEventPayload('created', values);
      }

      if (trigger.type === 'googleCalendarEventUpdated') {
        mockInput = buildCalendarEventPayload('updated', values);
      }

      await onRun(mockInput);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mock trigger run</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Provide production-shaped input for <span className="font-medium">{label}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-1">
          {trigger.type === 'apitrigger' && (
            <>
              {(apiFlags.requireBody || apiFlags.requireFile) ? null : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This API trigger does not require body or file input. The run will still open with an empty request payload.
                </p>
              )}
              {(apiFlags.requireBody || !apiFlags.requireFile) && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Request body (JSON)
                    {apiFlags.requireBody && <span className="ml-0.5 text-red-500">*</span>}
                  </label>
                  <div className="rounded-md border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <JsonInput
                      value={apiBodyTouched ? apiBody : {}}
                      onChange={(nextValue) => {
                        setApiBodyTouched(true);
                        setJsonError(null);
                        setApiBody(nextValue);
                      }}
                    />
                  </div>
                </div>
              )}
              {apiFlags.requireFile && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    File<span className="ml-0.5 text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              )}
            </>
          )}

          {trigger.type === 'emailtrigger' && (
            <>
              {[
                ['from', 'From', 'sender@example.com'],
                ['to', 'To', 'inbox@example.com'],
                ['cc', 'Cc', 'cc@example.com'],
                ['bcc', 'Bcc', 'bcc@example.com'],
                ['subject', 'Subject', 'New inbound email'],
                ['snippet', 'Snippet', 'Short preview text'],
              ].map(([key, heading, placeholder]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{heading}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={values[key] ?? ''}
                    onChange={(event) => setValue(key, event.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Body</label>
                <textarea
                  placeholder="Email body"
                  value={values.body ?? ''}
                  onChange={(event) => setValue('body', event.target.value)}
                  className="h-40 w-full resize-none overflow-y-auto rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Attachments</label>
                <input
                  type="file"
                  multiple
                  onChange={(event) => setEmailAttachments(Array.from(event.target.files ?? []))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </>
          )}

          {trigger.type === 'slacktrigger' && (
            <>
              {[
                ['text', 'Message text', 'Hello from Slack'],
                ['user', 'User ID', 'U12345678'],
                ['channel', 'Channel ID', trigger.data?.slackChannelId || 'C12345678'],
                ['ts', 'Timestamp', `${Math.floor(Date.now() / 1000)}.000100`],
                ['thread_ts', 'Thread timestamp', ''],
              ].map(([key, heading, placeholder]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{heading}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={values[key] ?? ''}
                    onChange={(event) => setValue(key, event.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Blocks (JSON)</label>
                <textarea
                  rows={4}
                  placeholder='[{"type":"section","text":{"type":"mrkdwn","text":"Hello"}}]'
                  value={values.blocks ?? ''}
                  onChange={(event) => setValue('blocks', event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Attachments (JSON)</label>
                <textarea
                  rows={4}
                  placeholder='[{"text":"Attachment text"}]'
                  value={values.attachments ?? ''}
                  onChange={(event) => setValue('attachments', event.target.value)}
                  className="mb-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </>
          )}

          {trigger.type === 'SchedulerDomino' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The scheduler mock will run with a current `triggeredAt` timestamp.
            </p>
          )}

          {(trigger.type === 'googleCalendarEventCreated' || trigger.type === 'googleCalendarEventUpdated') && (
            <>
              {[
                ['eventId', 'Event ID', 'evt_123'],
                ['calendarId', 'Calendar ID', 'primary'],
                ['summary', 'Summary', 'Team sync'],
                ['description', 'Description', 'Agenda for the meeting'],
                ['location', 'Location', 'Conference room'],
                ['status', 'Status', 'confirmed'],
                ['htmlLink', 'HTML link', ''],
                ['creatorEmail', 'Creator email', 'creator@example.com'],
                ['organizerEmail', 'Organizer email', 'organizer@example.com'],
              ].map(([key, heading, placeholder]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{heading}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={values[key] ?? ''}
                    onChange={(event) => setValue(key, event.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Start</label>
                  <input
                    type="datetime-local"
                    value={values.start ?? ''}
                    onChange={(event) => setValue('start', event.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">End</label>
                  <input
                    type="datetime-local"
                    value={values.end ?? ''}
                    onChange={(event) => setValue('end', event.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
            </>
          )}

          {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-60"
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
}
