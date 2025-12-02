'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { Edge, Node } from 'reactflow';
import { useRouter } from 'next/router';
import { config } from '../config/config';
import { AiChatApi, AiChatMessageDto, AiChatSender } from '../apis/aiChat.apis';
import { AIWorkflowResponse, normalizeAIResponseToWorkflow, serializeWorkflowForAI } from '../utils/aiWorkflow';

interface Message {
    id: string;
    content: string;
    sender: AiChatSender;
    timestamp: Date;
}

interface Props {
    isOpen: boolean;
    width: number;
    workflowId?: string;
    onClose: () => void;
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    getNodes: () => Node[];
    getEdges: () => Edge[];
}

export default function AIPanelDocked({ isOpen, width, workflowId, onClose, setEdges, setNodes, getNodes, getEdges }: Props) {
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

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;
        const prompt = inputValue.trim();

        const userMessage: Message = {
            id: `local-${Date.now()}`,
            content: prompt,
            sender: 'user',
            timestamp: new Date(),
        };
        mergeMessages([userMessage]);
        setInputValue('');
        persistMessage(userMessage.id, { content: prompt, sender: 'user' });

        setIsLoading(true);
        const currentNodes = getNodes();
        const currentEdges = getEdges();
        const workflowSnapshot = serializeWorkflowForAI(currentNodes, currentEdges);
        const revisionEntries = buildRevisionLog([...messagesRef.current, userMessage]);
        revisionLogRef.current = revisionEntries;

        try {
            const endpoint = `${config.aiBaseUrl.replace(/\/$/, '')}/generate`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: prompt,
                    current_json: workflowSnapshot,
                    revision_log: revisionEntries,
                }),
            });

            const raw = await response.text();
            let parsed: AIWorkflowResponse | { detail?: string } | null = null;
            if (raw) {
                try {
                    parsed = JSON.parse(raw);
                } catch (error) {
                    console.error('[AI] Failed to parse response JSON:', error, raw);
                    throw new Error('AI returned an unreadable response.');
                }
            }

            if (!response.ok) {
                const detail = (parsed as any)?.detail ?? response.statusText;
                throw new Error(detail || 'AI request failed.');
            }

            const normalized = normalizeAIResponseToWorkflow(parsed as AIWorkflowResponse, {
                workflowId: workflowSnapshot.workflowId,
                setNodes,
                existingNodes: currentNodes,
                existingEdges: currentEdges,
            });

            if (normalized) {
                origNodesRef.current = currentNodes;
                origEdgesRef.current = currentEdges;
                setNodes(normalized.nodes);
                setEdges(normalized.edges);
            }

            const explanation = (parsed as AIWorkflowResponse)?.explanation || 'AI generated an update for your workflow.';
            const status = (parsed as AIWorkflowResponse)?.status;
            const aiText = status ? `${explanation}\nStatus: ${status}` : explanation;
            const aiMessage: Message = {
                id: `local-ai-${Date.now()}`,
                content: aiText,
                sender: 'ai',
                timestamp: new Date(),
            };
            mergeMessages([aiMessage]);
            revisionLogRef.current = buildRevisionLog([...messagesRef.current, aiMessage]);
            persistMessage(aiMessage.id, { content: aiText, sender: 'ai' });
        } catch (err) {
            console.error('[AI] request failed:', err);
            const message =
                err instanceof Error
                    ? err.message
                    : 'Unexpected error while contacting the AI service.';
            const aiMessage: Message = {
                id: `${Date.now()}-err`,
                content: `Error: ${message}`,
                sender: 'ai',
                timestamp: new Date(),
            };
            mergeMessages([aiMessage]);
            persistMessage(aiMessage.id, { content: aiMessage.content, sender: 'ai' });
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
            style={{ width }}
        >
            <div
                className="flex-1 overflow-y-auto p-4 space-y-4"
                onScroll={handleScroll}
                ref={messagesContainerRef}
            >
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
            `}>
                            <p>{m.content}</p>
                            <div className="text-xs text-gray-500 mt-1">
                                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask me anything..."
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                            bg-dominofy-light-background dark:bg-dominofy-dark-background
                            text-dominofy-light-text dark:text-dominofy-dark-text
                            focus:outline-none focus:ring-2 focus:ring-dominofy-light-accent/50 dark:focus:ring-dominofy-dark-accent/50"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isLoading}
                        className="p-2 rounded-lg bg-dominofy-light-accent text-white hover:bg-dominofy-light-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <span className="text-xs px-1">...</span> : <FiSend size={18} />}
                    </button>
                </div>
                {isLoading && (
                    <p className="mt-2 text-xs text-gray-500">Generating workflow suggestions…</p>
                )}
                
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
            </form>
        </div>
    );
}
