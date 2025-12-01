'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { Edge, Node } from 'reactflow';
import { config } from '../config/config';
import { AIWorkflowResponse, normalizeAIResponseToWorkflow, serializeWorkflowForAI } from '../utils/aiWorkflow';

interface Message {
    id: string;
    content: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

interface Props {
    isOpen: boolean;
    width: number;
    onClose: () => void;
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    getNodes: () => Node[];
    getEdges: () => Edge[];
}

export default function AIPanelDocked({ isOpen, width, onClose, setEdges, setNodes, getNodes, getEdges }: Props) {

    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState<Message[]>([{
        id: 'init',
        content: `Hello! I'm your AI assistant. How can I help you with your workflow today?`,
        sender: 'ai',
        timestamp: new Date(),
    }]);
    const [isLoading, setIsLoading] = useState(false);

    // find all suggested nodes
    const suggestedNodes = getNodes().filter(n => n.data?.suggested);
    
    // 📦 keep a ref to the “real” nodes/edges before injecting fake
    const origNodesRef = useRef<Node[]>([]);
    const origEdgesRef = useRef<Edge[]>([]);
    const revisionLogRef = useRef<string[]>([]);

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

    // Reject (remove) all suggested dominoes  their edges
    const rejectAllSuggestions = useCallback(() => {
        // simply restore the pre-suggestion state
        setNodes(origNodesRef.current);
        setEdges(origEdgesRef.current);
    }, [setNodes, setEdges]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;
        const prompt = inputValue.trim();

        const userMessage: Message = {
            id: Date.now().toString(),
            content: prompt,
            sender: 'user',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');

        setIsLoading(true);
        const currentNodes = getNodes();
        const currentEdges = getEdges();
        const workflowSnapshot = serializeWorkflowForAI(currentNodes, currentEdges);
        const revisionEntries = [...revisionLogRef.current, `User: ${prompt}`].slice(-20);
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
                id: `${Date.now()}-ai`,
                content: aiText,
                sender: 'ai',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMessage]);
            revisionLogRef.current = [...revisionLogRef.current, `AI: ${explanation}`].slice(-20);
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
            setMessages(prev => [...prev, aiMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="flex flex-col bg-dominofy-light-panel dark:bg-dominofy-dark-panel border-l border-gray-200 dark:border-gray-700"
            style={{ width }}
        >
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                        onClick={acceptAllSuggestions}
                        className="px-2 py-1 bg-green-600 text-white rounded text-sm shadow"
                    >
                        Accept All
                    </button>
                    <button
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
