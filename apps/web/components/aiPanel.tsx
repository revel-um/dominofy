'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Edge, Node } from 'reactflow';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { Check, User2, X } from 'lucide-react';
import { config } from '../config/config';
import { AiChatApi, AiChatMessageDto, AiChatSender } from '../apis/aiChat.apis';
import { AIWorkflowResponse, normalizeAIResponseToWorkflow, serializeWorkflowForAI } from '../utils/aiWorkflow';
import { Button } from '@/components/ui/button';
import PromptInputDynamicGrow from '@/components/ui/prompt-input-dynamic-grow';
import { authFetch } from '../utils/authFetch';

interface Message {
    id: string;
    content: string;
    sender: AiChatSender;
    timestamp: Date;
    thoughtSummaries?: string[];
    streamStatus?: string;
    isStreaming?: boolean;
}

interface Props {
    isOpen: boolean;
    width: number;
    workflowId?: string;
    onClose: () => void;
    transition?: string;
    isResizing?: boolean;
    updatePipeline: (nodes?: Node[], edges?: Edge[]) => void;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    getNodes: () => Node[];
    getEdges: () => Edge[];
}

function isAbortError(error: unknown): boolean {
    if (error instanceof DOMException) {
        return error.name === 'AbortError';
    }
    if (error instanceof Error) {
        return error.name === 'AbortError' || /aborted|abort/i.test(error.message);
    }
    return false;
}

function ThoughtSummaries({ steps }: { steps: string[] }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-1 mb-2">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
                <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                <span>{open ? 'Hide' : 'Show'} thought summary ({steps.length} steps)</span>
            </button>
            {open && (
                <ol className="mt-1.5 ml-1 space-y-1 border-l border-gray-600 pl-3">
                    {steps.map((step, i) => (
                        <li key={i} className="text-xs text-gray-400 leading-snug">
                            <span className="text-gray-500 mr-1">{i + 1}.</span>{step}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

export default function AIPanelDocked({ isOpen, width, workflowId, onClose, transition, isResizing, updatePipeline, onHoverStart, onHoverEnd, setEdges, setNodes, getNodes, getEdges }: Props) {
    const router = useRouter();

    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [historyCursor, setHistoryCursor] = useState<string | null>(null);
    const [clockTick, setClockTick] = useState(() => Date.now());

    // find all suggested nodes
    const suggestedNodes = useMemo(() => getNodes().filter(n => n.data?.suggested), [getNodes]);
    
    // 📦 keep a ref to the “real” nodes/edges before injecting fake
    const origNodesRef = useRef<Node[]>([]);
    const origEdgesRef = useRef<Edge[]>([]);
    const revisionLogRef = useRef<string[]>([]);
    const messagesRef = useRef<Message[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const suppressAutoScrollRef = useRef(false);
    const stickToBottomRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const defaultAiGreeting = useMemo<Message>(() => ({
        id: 'init',
        content: `Hello! I'm your AI assistant. How can I help you with your workflow today?`,
        sender: 'ai',
        timestamp: new Date(),
    }), []);

    // Accept all suggested dominoes
    const acceptAllSuggestions = useCallback(() => {
        setNodes(nds =>
            nds.map(n =>
                n.data?.suggested
                    ? { ...n, data: { ...n.data, suggested: false } }
                    : n
            )
        );
    }, [setNodes]);

    // Reject (remove) all suggested dominoes + their edges
    const rejectAllSuggestions = useCallback(() => {
        setNodes(origNodesRef.current);
        setEdges(origEdgesRef.current);
    }, [setNodes, setEdges]);

    const sortChronologically = useCallback((items: Message[]) => {
        return [...items].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }, []);

    const dedupeMessages = useCallback((items: Message[]) => {
        const seen = new Set<string>();
        return items.filter((msg) => {
            if (seen.has(msg.id)) return false;
            seen.add(msg.id);
            return true;
        });
    }, []);

    const mapDtoToMessage = useCallback((dto: AiChatMessageDto): Message => ({
        id: dto.id,
        content: dto.content,
        sender: dto.sender,
        timestamp: new Date(dto.createdAt),
    }), []);

    const normalizeDtos = useCallback((items: AiChatMessageDto[] = []) => {
        return sortChronologically(dedupeMessages(items.map(mapDtoToMessage)));
    }, [dedupeMessages, mapDtoToMessage, sortChronologically]);

    const getToken = useCallback(() => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('token');
    }, []);

    const buildRevisionLog = useCallback((list: Message[]) =>
        list.slice(-20).map(m => `${m.sender === 'user' ? 'User' : 'AI'}: ${m.content}`),
    []);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    }, []);

    const scheduleScrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scrollToBottom(behavior);
            });
        });
    }, [scrollToBottom]);

    const isNearBottom = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return true;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        return distanceFromBottom < 120;
    }, []);

    useEffect(() => {
        const interval = window.setInterval(() => setClockTick(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        messagesRef.current = messages;
        revisionLogRef.current = buildRevisionLog(messages);
    }, [messages, buildRevisionLog]);

    const ensureGreeting = useCallback(() => {
        setMessages(prev => prev.length ? prev : [defaultAiGreeting]);
    }, [defaultAiGreeting]);

    const loadLatestMessages = useCallback(async () => {
        if (!workflowId) {
            ensureGreeting();
            setHasMoreHistory(false);
            return;
        }

        const token = getToken();
        if (!token) {
            ensureGreeting();
            setHasMoreHistory(false);
            return;
        }

        setHistoryLoading(true);
        try {
            const response = await AiChatApi.getMessages(workflowId, token, router, { limit: 25 });
            if (!response?.ok) {
                ensureGreeting();
                setHasMoreHistory(false);
                return;
            }

            const data = await response.json();
            const normalized = normalizeDtos(Array.isArray(data?.items) ? data.items : []);
            setMessages(normalized.length ? normalized : [defaultAiGreeting]);
            setHasMoreHistory(Boolean(data?.hasMore));
            setHistoryCursor(data?.nextCursor ?? null);
            requestAnimationFrame(() => scrollToBottom('auto'));
        } catch (err) {
            console.error('[AI] failed to load chat history', err);
            ensureGreeting();
        } finally {
            setHistoryLoading(false);
        }
    }, [workflowId, getToken, router, normalizeDtos, defaultAiGreeting, ensureGreeting, scrollToBottom]);

    useEffect(() => {
        setMessages([]);
        setHistoryCursor(null);
        setHasMoreHistory(true);
        loadLatestMessages();
    }, [workflowId, loadLatestMessages]);

    const loadOlderMessages = useCallback(async () => {
        if (!workflowId || !hasMoreHistory || historyLoading) return;

        const token = getToken();
        if (!token) return;

        const cursor = historyCursor ?? messagesRef.current[0]?.timestamp?.toISOString();
        if (!cursor) return;

        const container = messagesContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;
        const prevScrollTop = container?.scrollTop ?? 0;

        suppressAutoScrollRef.current = true;
        setHistoryLoading(true);
        try {
            const response = await AiChatApi.getMessages(workflowId, token, router, { limit: 25, before: cursor });
            if (!response?.ok) return;

            const data = await response.json();
            const normalized = normalizeDtos(Array.isArray(data?.items) ? data.items : []);

            if (!normalized.length) {
                setHasMoreHistory(false);
                return;
            }

            setHasMoreHistory(Boolean(data?.hasMore));
            setHistoryCursor(data?.nextCursor ?? null);
            setMessages(prev => {
                const merged = sortChronologically(dedupeMessages([...normalized, ...prev]));
                return merged;
            });

            requestAnimationFrame(() => {
                if (!container) return;
                const newScrollHeight = container.scrollHeight;
                container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
                suppressAutoScrollRef.current = false;
            });
        } catch (err) {
            console.error('[AI] failed to load older chat messages', err);
        } finally {
            setHistoryLoading(false);
            suppressAutoScrollRef.current = false;
        }
    }, [workflowId, hasMoreHistory, historyLoading, getToken, historyCursor, normalizeDtos, sortChronologically, dedupeMessages, router]);

    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container || historyLoading || !hasMoreHistory) return;
        if (!suppressAutoScrollRef.current) {
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            stickToBottomRef.current = distanceFromBottom < 120;
        }
        if (container.scrollTop < 60) {
            loadOlderMessages();
        }
    }, [historyLoading, hasMoreHistory, loadOlderMessages]);

    const persistMessage = useCallback(async (tempId: string, payload: { content: string; sender: AiChatSender }) => {
        if (!workflowId) return;
        const token = getToken();
        if (!token) return;

        try {
            const response = await AiChatApi.saveMessage(workflowId, payload, token, router);
            if (!response?.ok) return;
            const saved = await response.json() as AiChatMessageDto;
            setMessages(prev => prev.map(msg =>
                msg.id === tempId
                    ? {
                        ...msg,
                        id: saved.id || msg.id,
                        timestamp: saved.createdAt ? new Date(saved.createdAt) : msg.timestamp,
                      }
                    : msg
            ));
        } catch (err) {
            console.error('[AI] failed to persist chat message', err);
        }
    }, [workflowId, getToken, router]);

    const mergeMessages = useCallback((incoming: Message[]) => {
        setMessages(prev => {
            const merged = sortChronologically(dedupeMessages([...prev, ...incoming]));
            messagesRef.current = merged;
            return merged;
        });
        if (stickToBottomRef.current && !suppressAutoScrollRef.current) {
            scheduleScrollToBottom('smooth');
        }
    }, [dedupeMessages, sortChronologically, scheduleScrollToBottom]);

    const updateMessage = useCallback((id: string, updater: (message: Message) => Message) => {
        setMessages(prev => {
            const updated = prev.map(message => message.id === id ? updater(message) : message);
            messagesRef.current = updated;
            return updated;
        });
        if (stickToBottomRef.current && !suppressAutoScrollRef.current) {
            scheduleScrollToBottom('smooth');
        }
    }, [scheduleScrollToBottom]);

    const consumeNdjsonStream = useCallback(async (
        response: Response,
        onEvent: (event: any) => void,
    ) => {
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('AI preview stream is unavailable.');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                let newlineIndex = buffer.indexOf('\n');
                while (newlineIndex >= 0) {
                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);
                    if (line) {
                        onEvent(JSON.parse(line));
                    }
                    newlineIndex = buffer.indexOf('\n');
                }
            }
        } catch (error) {
            if (isAbortError(error)) {
                return;
            }
            throw error;
        }

        const finalLine = buffer.trim();
        if (finalLine) {
            onEvent(JSON.parse(finalLine));
        }
    }, []);

    const stopGeneration = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    const handleSendMessage = async (submittedValue: string) => {
        if (!submittedValue.trim() || isLoading) return;
        const prompt = submittedValue.trim();

        const userMessage: Message = {
            id: `local-${Date.now()}`,
            content: prompt,
            sender: 'user',
            timestamp: new Date(),
        };
        stickToBottomRef.current = true;
        mergeMessages([userMessage]);
        setInputValue('');
        persistMessage(userMessage.id, { content: prompt, sender: 'user' });

        const streamingMessageId = `local-ai-stream-${Date.now()}`;
        const streamingAiMessage: Message = {
            id: streamingMessageId,
            content: '',
            sender: 'ai',
            timestamp: new Date(),
            thoughtSummaries: [],
            streamStatus: 'Preparing your workflow preview...',
            isStreaming: true,
        };
        mergeMessages([streamingAiMessage]);
        scheduleScrollToBottom('auto');

        setIsLoading(true);
        const currentNodes = getNodes();
        const currentEdges = getEdges();
        const workflowSnapshot = serializeWorkflowForAI(currentNodes, currentEdges);
        const revisionEntries = buildRevisionLog([...messagesRef.current, userMessage]);
        revisionLogRef.current = revisionEntries;

        try {
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            let response: Response;

            if (workflowId) {
                const endpoint = `${config.backendBaseUrl.replace(/\/$/, '')}/workflow/${workflowId}/revisions/ai-preview/stream`;
                response = await authFetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: abortController.signal,
                    body: JSON.stringify({
                        prompt: `${prompt}\n\nUser priority: this instruction overrides any past revision logs. If this prompt conflicts with previous requests, follow this prompt.`,
                        current_json: workflowSnapshot,
                    }),
                }, router);
            } else {
                const endpoint = `${config.aiBaseUrl.replace(/\/$/, '')}/generate-stream`;
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: abortController.signal,
                    body: JSON.stringify({
                        text: `${prompt}\n\nUser priority: this instruction overrides any past revision logs. If this prompt conflicts with previous requests, follow this prompt.`,
                        current_json: workflowSnapshot,
                        revision_log: revisionEntries,
                    }),
                });
            }

            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'AI request failed.');
            }

            let finalResult: AIWorkflowResponse | null = null;
            await consumeNdjsonStream(response, (event) => {
                if (event.type === 'status') {
                    updateMessage(streamingMessageId, message => ({
                        ...message,
                        streamStatus: event.message || message.streamStatus,
                    }));
                    return;
                }

                if (event.type === 'thought_summaries') {
                    updateMessage(streamingMessageId, message => ({
                        ...message,
                        thoughtSummaries: Array.isArray(event.thought_summaries)
                            ? event.thought_summaries
                            : message.thoughtSummaries,
                    }));
                    return;
                }

                if (event.type === 'result') {
                    finalResult = event as AIWorkflowResponse;
                    return;
                }

                if (event.type === 'error') {
                    throw new Error(event.detail || 'AI stream failed.');
                }
            });

            if (!finalResult) {
                if (abortController.signal.aborted) {
                    throw new DOMException('Generation stopped.', 'AbortError');
                }
                throw new Error('AI preview ended before returning a result.');
            }

            const parsedResponse = finalResult as AIWorkflowResponse;

            const normalized = normalizeAIResponseToWorkflow(parsedResponse, {
                workflowId: workflowId ?? workflowSnapshot.workflowId,
                setNodes,
                existingNodes: currentNodes,
                existingEdges: currentEdges,
            });

            if (normalized) {
                const enhancedNodes = normalized.nodes.map((node, idx) => {
                    const currentKey =
                        typeof node.data?.renderKey === 'number' ? node.data.renderKey : 0;
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            setNodes,
                            updatePipeline,
                            suggested: true,
                            // clear stale pending overrides on suggested nodes so accept/reject prompt appears
                            pendingFieldOverrides: undefined,
                            renderKey: currentKey + 1, // force rerender after AI update
                        },
                        selected: idx === 0,
                    };
                });
                origNodesRef.current = currentNodes;
                origEdgesRef.current = currentEdges;
                setNodes(enhancedNodes);
                setEdges(normalized.edges);
            }

            const explanation = parsedResponse?.explanation || 'AI generated an update for your workflow.';
            const aiText = explanation;
            const thoughtSummaries =
                parsedResponse?.thought_summaries ||
                parsedResponse?.chain_of_thought;
            updateMessage(streamingMessageId, message => ({
                ...message,
                content: aiText,
                thoughtSummaries,
                streamStatus: undefined,
                isStreaming: false,
            }));
            const finalAiMessage: Message = {
                ...streamingAiMessage,
                content: aiText,
                timestamp: new Date(),
                thoughtSummaries,
                streamStatus: undefined,
                isStreaming: false,
            };
            revisionLogRef.current = buildRevisionLog([...messagesRef.current, finalAiMessage]);
            persistMessage(streamingMessageId, { content: aiText, sender: 'ai' });
        } catch (err) {
            const isAborted = isAbortError(err);
            if (!isAborted) {
                console.error('[AI] request failed:', err);
            }
            const message = isAborted
                ? 'Generation stopped.'
                : err instanceof Error
                    ? err.message
                    : 'Unexpected error while contacting the AI service.';
            updateMessage(streamingMessageId, current => ({
                ...current,
                content: isAborted ? message : `Error: ${message}`,
                streamStatus: undefined,
                isStreaming: false,
            }));
            persistMessage(streamingMessageId, { content: isAborted ? message : `Error: ${message}`, sender: 'ai' });
        } finally {
            abortControllerRef.current = null;
            stickToBottomRef.current = false;
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen || suppressAutoScrollRef.current) return;
        if (stickToBottomRef.current || isNearBottom()) {
            scrollToBottom(messagesRef.current.length > 15 ? 'smooth' : 'auto');
        }
    }, [messages, isOpen, isNearBottom, scrollToBottom]);

    return (
        <div
            className={`relative flex flex-col overflow-hidden border-l border-gray-200 bg-dominofy-light-panel dark:border-gray-700 dark:bg-dominofy-dark-panel ${
                isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
            style={{
                width: isOpen ? width : 0,
                minWidth: isOpen ? width : 0,
                transition: isResizing ? 'none' : transition,
                userSelect: 'text',
                WebkitUserSelect: 'text',
                visibility: isOpen ? 'visible' : 'hidden',
            }}
            onMouseEnter={isOpen ? onHoverStart : undefined}
            onMouseLeave={isOpen ? onHoverEnd : undefined}
            data-allow-copy="true"
            aria-hidden={!isOpen}
        >
            <div
                className={`relative flex-1 overflow-y-auto px-4 py-5 ${isResizing ? 'transition-none' : ''}`}
                onScroll={handleScroll}
                ref={messagesContainerRef}
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
            >
                {isLoading && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
                        <div className="mt-2 h-1 w-36 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div className="h-full w-1/3 animate-[slide_1.8s_ease_infinite] rounded-full bg-sky-500" />
                        </div>
                    </div>
                )}
                {historyLoading && hasMoreHistory && (
                    <div className="py-2 text-center text-xs text-slate-500">
                        Loading earlier messages…
                    </div>
                )}

                <div className="relative z-10 space-y-5">
                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[86%] ${m.sender === 'ai' ? 'mr-10' : 'ml-10'}`}>
                            <div className={`mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] ${m.sender === 'ai' ? 'text-slate-500 dark:text-slate-400' : 'justify-end text-slate-400 dark:text-slate-500'}`}>
                                {m.sender === 'ai' ? (
                                    <>
                                        <span className="flex h-7 w-7 items-center justify-center overflow-hidden">
                                            <Image
                                                src="/dominofy.png"
                                                alt="Dominofy"
                                                width={20}
                                                height={20}
                                                className="h-6 w-6 object-contain"
                                            />
                                        </span>
                                        {m.isStreaming && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-600 dark:text-sky-300">Live</span>}
                                    </>
                                ) : (
                                    <>
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300/80 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                            <User2 className="h-4 w-4" />
                                        </span>
                                    </>
                                )}
                            </div>
                            <div
                                className={`rounded-[1.5rem] border p-4 text-sm shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)] backdrop-blur-xl selection:bg-sky-200 selection:text-slate-950 ${
                                    m.sender === 'ai'
                                        ? 'border-slate-200/80 bg-white/80 text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200'
                                        : 'border-sky-500/15 bg-gradient-to-br from-sky-500 to-blue-600 text-white selection:bg-white/90 selection:text-sky-950'
                                }`}
                                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                            >
                            {m.sender === 'ai' && m.isStreaming && (
                                <div className="mb-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span>Thinking</span>
                                        <span className="flex items-center gap-1" aria-hidden="true">
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:200ms]" />
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:400ms]" />
                                        </span>
                                    </span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                        {Math.max(0, Math.floor((clockTick - m.timestamp.getTime()) / 1000))}s
                                    </span>
                                </div>
                            )}
                            {m.sender === 'ai' && !m.isStreaming && m.thoughtSummaries && m.thoughtSummaries.length > 0 && (
                                <ThoughtSummaries steps={m.thoughtSummaries} />
                            )}
                            {m.sender === 'ai' && m.isStreaming && m.streamStatus && (
                                <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                                    {m.streamStatus}
                                </div>
                            )}
                            {m.content ? (
                                <p className={`whitespace-pre-wrap break-words leading-7 ${m.sender === 'user' ? 'text-white/95 selection:bg-white/90 selection:text-sky-950' : ''}`} style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{m.content}</p>
                            ) : (
                                m.sender !== 'ai' || !m.isStreaming ? null : null
                            )}
                            <div className={`mt-1 text-right text-xs ${m.sender === 'user' ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            </div>
                        </div>
                    </div>
                ))}
                </div>
                <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200/70 bg-dominofy-light-panel py-3 px-4 dark:border-slate-800 dark:bg-dominofy-dark-panel" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                <PromptInputDynamicGrow
                    value={inputValue}
                    onValueChange={setInputValue}
                    onSubmit={(nextValue) => void handleSendMessage(nextValue)}
                    onStop={stopGeneration}
                    placeholder="Ask me anything..."
                    disabled={isLoading}
                    isLoading={isLoading}
                    className="w-full"
                    expandOnFocus={false}
                    backgroundOpacity={0.82}
                    glowIntensity={0.32}
                />
                {suggestedNodes.length > 0 && (
                    <div
                        className="relative top-3 z-20 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/15 bg-gradient-to-r from-emerald-500/8 via-transparent to-rose-500/8 px-3 py-3"
                        style={{ pointerEvents: 'auto' }}
                    >
                        <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {suggestedNodes.length} suggested node{suggestedNodes.length > 1 ? 's' : ''} ready for review
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Accept to keep the AI proposal on the canvas, or reject to restore the previous state.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={acceptAllSuggestions}
                                className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                <Check className="h-4 w-4" />
                                Accept All
                            </Button>
                            <Button
                                type="button"
                                onClick={rejectAllSuggestions}
                                variant="outline"
                                className="gap-2 border-rose-200 bg-white/80 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/60 dark:bg-slate-950/70 dark:text-rose-300 dark:hover:bg-rose-950/30"
                            >
                                <X className="h-4 w-4" />
                                Reject All
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
