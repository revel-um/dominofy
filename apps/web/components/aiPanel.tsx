'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Edge, Node } from 'reactflow';
import { useRouter } from 'next/router';
import { config } from '../config/config';
import { AiChatApi, AiChatMessageDto, AiChatSender } from '../apis/aiChat.apis';
import { AIWorkflowResponse, normalizeAIResponseToWorkflow, serializeWorkflowForAI } from '../utils/aiWorkflow';
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

function StreamingPlaceholder({ status }: { status?: string }) {
    return (
        <div className="mb-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                <span>{status || 'Working on your workflow preview...'}</span>
            </div>
            <div className="mt-2 space-y-2">
                <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-white/10" />
                <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-white/10" />
                <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-white/10" />
            </div>
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

    const isNearBottom = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return true;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        return distanceFromBottom < 120;
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
        if (!isOpen) return;
        setMessages([]);
        setHistoryCursor(null);
        setHasMoreHistory(true);
        loadLatestMessages();
    }, [isOpen, workflowId, loadLatestMessages]);

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
    }, [dedupeMessages, sortChronologically]);

    const updateMessage = useCallback((id: string, updater: (message: Message) => Message) => {
        setMessages(prev => {
            const updated = prev.map(message => message.id === id ? updater(message) : message);
            messagesRef.current = updated;
            return updated;
        });
    }, []);

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

        const finalLine = buffer.trim();
        if (finalLine) {
            onEvent(JSON.parse(finalLine));
        }
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

        setIsLoading(true);
        const currentNodes = getNodes();
        const currentEdges = getEdges();
        const workflowSnapshot = serializeWorkflowForAI(currentNodes, currentEdges);
        const revisionEntries = buildRevisionLog([...messagesRef.current, userMessage]);
        revisionLogRef.current = revisionEntries;

        try {
            let response: Response;

            if (workflowId) {
                const endpoint = `${config.backendBaseUrl.replace(/\/$/, '')}/workflow/${workflowId}/revisions/ai-preview/stream`;
                response = await authFetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                throw new Error('AI preview ended before returning a result.');
            }

            const parsedResponse = finalResult as AIWorkflowResponse;

            const normalized = normalizeAIResponseToWorkflow(parsedResponse, {
                workflowId: workflowSnapshot.workflowId,
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
            const status = parsedResponse?.status;
            const hasWorkflowNodes = parsedResponse?.nodes && parsedResponse.nodes.length > 0;
            const aiText = (status && hasWorkflowNodes) ? `${explanation}\nStatus: ${status}` : explanation;
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
            console.error('[AI] request failed:', err);
            const message =
                err instanceof Error
                    ? err.message
                    : 'Unexpected error while contacting the AI service.';
            updateMessage(streamingMessageId, current => ({
                ...current,
                content: `Error: ${message}`,
                streamStatus: undefined,
                isStreaming: false,
            }));
            persistMessage(streamingMessageId, { content: `Error: ${message}`, sender: 'ai' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen || suppressAutoScrollRef.current) return;
        if (isNearBottom()) {
            scrollToBottom(messagesRef.current.length > 15 ? 'smooth' : 'auto');
        }
    }, [messages, isOpen, isNearBottom, scrollToBottom]);

    if (!isOpen) return null;

    return (
        <div
            className="flex flex-col bg-dominofy-light-panel dark:bg-dominofy-dark-panel border-l border-gray-200 dark:border-gray-700"
            style={{ width, transition: isResizing ? 'none' : transition, userSelect: 'text', WebkitUserSelect: 'text' }}
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            data-allow-copy="true"
        >
            <div
                className={`relative flex-1 overflow-y-auto p-4 space-y-4 ${isResizing ? 'transition-none' : ''}`}
                onScroll={handleScroll}
                ref={messagesContainerRef}
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
            >
                {isLoading && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
                        <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full w-1/3 animate-[slide_1.8s_ease_infinite] rounded-full bg-white/70" />
                        </div>
                    </div>
                )}
                {historyLoading && hasMoreHistory && (
                    <div className="text-center text-xs text-gray-500 py-2">
                        Loading earlier messages…
                    </div>
                )}

                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg text-sm ${m.sender === 'ai'
                            ? 'bg-dominofy-light-accent/10 dark:bg-dominofy-dark-accent/20'
                            : 'bg-dominofy-light-accent/20 dark:bg-dominofy-dark-accent/30'}
            `} style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                            {m.sender === 'ai' && m.thoughtSummaries && m.thoughtSummaries.length > 0 && (
                                <ThoughtSummaries steps={m.thoughtSummaries} />
                            )}
                            {m.sender === 'ai' && m.isStreaming && (!m.thoughtSummaries || m.thoughtSummaries.length === 0) && (
                                <StreamingPlaceholder status={m.streamStatus} />
                            )}
                            {m.sender === 'ai' && m.isStreaming && m.streamStatus && m.thoughtSummaries && m.thoughtSummaries.length > 0 && (
                                <div className="mb-2 text-xs text-slate-400">{m.streamStatus}</div>
                            )}
                            {m.content ? (
                                <p className="whitespace-pre-wrap break-words" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{m.content}</p>
                            ) : (
                                m.sender !== 'ai' || !m.isStreaming ? null : null
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-gray-200 p-3 dark:border-gray-700" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                <PromptInputDynamicGrow
                    value={inputValue}
                    onValueChange={setInputValue}
                    onSubmit={(nextValue) => void handleSendMessage(nextValue)}
                    placeholder="Ask me anything..."
                    disabled={isLoading}
                    isLoading={isLoading}
                    className="w-full"
                    expandOnFocus={false}
                    backgroundOpacity={0.82}
                    glowIntensity={0.32}
                />
                {/* ─── accept/reject ALL suggestions ─── */}
                {suggestedNodes.length > 0 && (
                    <div className="relative top-2 z-20 flex gap-2"
                    style={{ pointerEvents: 'auto' }}
                    >
                    <button
                        type="button"
                        onClick={acceptAllSuggestions}
                        className="px-2 py-1 bg-green-600 text-white rounded text-sm shadow"
                    >
                        Accept All
                    </button>
                    <button
                        type="button"
                        onClick={rejectAllSuggestions}
                        className="px-2 py-1 bg-red-600 text-white rounded text-sm shadow"
                    >
                        Reject All
                    </button>
                    </div>
                )}
            </div>
        </div>
    );
}
