'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Node } from 'reactflow';
import dominoCatalog from '../dominos/dominos';
import dominoReference from '../../ai/domino_reference.json';

interface Props {
    selectedNode?: Node;
    width: number;
    onClose: () => void;
    transition?: string;
    isResizing?: boolean;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
}

type DominoReferenceField = {
    heading?: string;
    type?: string;
    description?: string;
    required?: boolean;
    inPinId?: string;
    options?: Array<{ label: string; value: string }>;
    placeholder?: string;
    default?: unknown;
};

type DominoReferenceEntry = {
    id: string;
    label?: string;
    description?: string;
    category?: string;
    features?: string[];
    fields?: DominoReferenceField[];
    pinStructure?: Record<string, string>;
};

type DetailsField = {
    heading: string;
    type?: string;
    description?: string;
    required?: boolean;
    inPinId?: string;
    options?: Array<{ label: string; value: string }>;
    placeholder?: string;
    default?: unknown;
    value?: unknown;
    shouldRender?: boolean;
};

const referenceEntries = dominoReference as DominoReferenceEntry[];

const normaliseKey = (value?: string | null) =>
    (value ?? '')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

const referenceLookup = new Map<string, DominoReferenceEntry>();

referenceEntries.forEach((entry) => {
    if (!entry?.id) return;
    referenceLookup.set(normaliseKey(entry.id), entry);
    if (entry.label) {
        referenceLookup.set(normaliseKey(entry.label), entry);
    }
});

dominoCatalog.forEach((entry) => {
    const ref = referenceLookup.get(normaliseKey(entry.id)) || referenceLookup.get(normaliseKey(entry.label));
    if (!ref) return;
    referenceLookup.set(normaliseKey(entry.id), ref);
    referenceLookup.set(normaliseKey(entry.label), ref);
});

const prettifyType = (value?: string) => {
    if (!value) return 'Value';
    return value
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\bjson\b/gi, 'JSON')
        .replace(/\bapi\b/gi, 'API')
        .replace(/\bllm\b/gi, 'LLM')
        .replace(/\btextinput\b/gi, 'Text Input')
        .replace(/\btextarea\b/gi, 'Text Area')
        .replace(/\bmultiselect\b/gi, 'Multi Select')
        .replace(/\bkeyval\b/gi, 'Key Value')
        .replace(/\bdropdown\b/gi, 'Dropdown')
        .replace(/\bselect\b/gi, 'Dropdown');
};

const formatValue = (value: unknown) => {
    if (value === undefined || value === null || value === '') return 'Not configured';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch (_error) {
        return String(value);
    }
};

const getFallbackFieldDescription = (field: DetailsField) => {
    if (field.description) return field.description;
    if (field.inPinId) {
        return `Controls the ${field.heading.toLowerCase()} input. This field can also be supplied dynamically through the ${field.inPinId} pin.`;
    }

    if (field.options?.length) {
        return `Select how ${field.heading.toLowerCase()} should behave for this domino.`;
    }

    return `Defines the ${field.heading.toLowerCase()} setting for this domino.`;
};

const mergeFields = (referenceFields: DominoReferenceField[] = [], currentFields: any[] = []): DetailsField[] => {
    const currentByHeading = new Map(
        currentFields
            .filter((field) => field?.heading)
            .map((field) => [normaliseKey(field.heading), field])
    );

    const merged: DetailsField[] = referenceFields
        .filter((field) => field?.heading)
        .map((field) => {
            const current = currentByHeading.get(normaliseKey(field.heading));
            return {
                heading: field.heading!,
                type: current?.type ?? field.type,
                description: field.description ?? current?.description,
                required: current?.required ?? field.required,
                inPinId: current?.inPinId ?? field.inPinId,
                options: current?.options ?? field.options,
                placeholder: current?.placeholder ?? field.placeholder,
                default: field.default,
                value: current?.value,
                shouldRender: current?.shouldRender,
            };
        });

    const existingHeadings = new Set(merged.map((field) => normaliseKey(field.heading)));
    currentFields.forEach((field) => {
        if (!field?.heading) return;
        const key = normaliseKey(field.heading);
        if (existingHeadings.has(key)) return;
        merged.push({
            heading: field.heading,
            type: field.type,
            description: field.description,
            required: field.required,
            inPinId: field.inPinId,
            options: field.options,
            placeholder: field.placeholder,
            value: field.value,
            shouldRender: field.shouldRender,
        });
    });

    return merged;
};

export default function DetailsMainPanel({ selectedNode, width, transition, isResizing, onHoverStart, onHoverEnd }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const showRawData = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

    useEffect(() => {
        if (!containerRef.current) return;
        containerRef.current.scrollTop = 0;
    }, [selectedNode?.id]);

    const detailsContent = useMemo(() => {
        const details = selectedNode?.data?.details;
        const currentFields = Array.isArray(details?.fields) ? details.fields : [];
        const reference = referenceLookup.get(normaliseKey(selectedNode?.type))
            || referenceLookup.get(normaliseKey(details?.type))
            || referenceLookup.get(normaliseKey(selectedNode?.data?.type))
            || referenceLookup.get(normaliseKey(selectedNode?.data?.label));

        const title = details?.type || reference?.label || selectedNode?.data?.label || selectedNode?.type || 'Domino';
        const description = details?.description || reference?.description || 'Configuration details for this domino.';
        const features = Array.isArray(reference?.features) ? reference.features : [];
        const fields = mergeFields(reference?.fields, currentFields);
        const pinStructure = reference?.pinStructure ? Object.entries(reference.pinStructure) : [];

        return {
            title,
            description,
            features,
            fields,
            pinStructure,
        };
    }, [selectedNode]);

    return (
        <div
            ref={containerRef}
            className="min-w-0 shrink-0 overflow-x-hidden overflow-y-auto border-l border-gray-200 bg-dominofy-light-panel px-4 pb-6 dark:border-gray-700 dark:bg-dominofy-dark-panel"
            style={{
                width,
                minWidth: width,
                maxWidth: width,
                flex: `0 0 ${width}px`,
                transition: isResizing ? 'none' : transition,
            }}
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
        >
            {!selectedNode && (
                <p className="pt-4 text-sm text-gray-500 dark:text-gray-400">
                    Select a domino on the canvas to view its details.
                </p>
            )}

            {selectedNode && (
                <div className="space-y-6 py-4">
                    <div className="space-y-3 border-b border-gray-200 pb-4 dark:border-gray-700">
                        <h2 className="text-2xl font-bold text-dominofy-light-text dark:text-dominofy-dark-text">
                            {detailsContent.title}
                        </h2>
                        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                            {detailsContent.description}
                        </p>
                    </div>

                    {detailsContent.features.length > 0 && (
                        <section className="space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                What It Does
                            </div>
                            <div className="space-y-2">
                                {detailsContent.features.map((feature, index) => (
                                    <div
                                        key={`${selectedNode.id}-feature-${index}`}
                                        className="rounded-xl border border-gray-200 bg-white/70 px-3 py-3 text-sm leading-6 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200"
                                    >
                                        {feature}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                            Fields
                        </div>

                        {detailsContent.fields.length === 0 && (
                            <div className="rounded-xl border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                This domino does not expose configurable fields.
                            </div>
                        )}

                        {detailsContent.fields.map((field) => {
                            const formattedValue = formatValue(field.value);
                            const defaultValue = formatValue(field.default);
                            return (
                                <article
                                    key={`${selectedNode.id}-${field.heading}`}
                                    className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-semibold text-dominofy-light-text dark:text-dominofy-dark-text">
                                            {field.heading}
                                        </h3>
                                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                            {prettifyType(field.type)}
                                        </span>
                                        {field.required && (
                                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                                Required
                                            </span>
                                        )}
                                        {field.inPinId && (
                                            <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                                                Input Pin: {field.inPinId}
                                            </span>
                                        )}
                                        {field.shouldRender === false && (
                                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                                                Hidden In Node UI
                                            </span>
                                        )}
                                    </div>

                                    <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                                        {getFallbackFieldDescription(field)}
                                    </p>

                                    {(field.placeholder || field.default !== undefined) && (
                                        <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            {field.placeholder && (
                                                <div>
                                                    <span className="font-medium text-dominofy-light-text dark:text-dominofy-dark-text">Example input:</span>{' '}
                                                    {field.placeholder}
                                                </div>
                                            )}
                                            {field.default !== undefined && defaultValue !== 'Not configured' && (
                                                <div>
                                                    <span className="font-medium text-dominofy-light-text dark:text-dominofy-dark-text">Default:</span>{' '}
                                                    {defaultValue}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {field.options && field.options.length > 0 && (
                                        <div className="mt-3">
                                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                                Available Options
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {field.options.map((option) => (
                                                    <span
                                                        key={`${field.heading}-${option.value}`}
                                                        className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200"
                                                    >
                                                        {option.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4">
                                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                            Current Value
                                        </div>
                                        <pre className="overflow-x-auto rounded-xl bg-gray-100 p-3 text-xs leading-5 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                            {formattedValue}
                                        </pre>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    {detailsContent.pinStructure.length > 0 && (
                        <section className="space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                Pins
                            </div>
                            <div className="space-y-2">
                                {detailsContent.pinStructure.map(([pin, description]) => (
                                    <div
                                        key={`${selectedNode.id}-${pin}`}
                                        className="rounded-xl border border-gray-200 bg-white/70 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/40"
                                    >
                                        <div className="text-sm font-semibold text-dominofy-light-text dark:text-dominofy-dark-text">
                                            {pin}
                                        </div>
                                        <div className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                                            {description}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {showRawData && selectedNode?.data && (
                        <section>
                            <p className="mb-1 text-xs text-gray-500">Raw Data</p>
                            <pre className="overflow-x-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">
                                {JSON.stringify(selectedNode.data, null, 2)}
                            </pre>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
