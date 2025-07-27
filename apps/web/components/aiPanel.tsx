'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FiSend } from 'react-icons/fi';

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
}

export default function AIPanelDocked({ isOpen, width, onClose }: Props) {
    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState<Message[]>([{
        id: 'init',
        content: `Hello! I'm your AI assistant. How can I help you with your workflow today?`,
        sender: 'ai',
        timestamp: new Date(),
    }]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        const userMessage: Message = {
            id: Date.now().toString(),
            content: inputValue,
            sender: 'user',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');

        setTimeout(() => {
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: `Simulated response to: "${userMessage.content}"`,
                sender: 'ai',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMessage]);
        }, 800);
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
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-dominofy-light-background dark:bg-dominofy-dark-background"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="p-2 rounded-lg bg-dominofy-light-accent text-white hover:bg-dominofy-light-accent/90"
                    >
                        <FiSend size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
}
