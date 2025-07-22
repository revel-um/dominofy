'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { ArrowUp, PauseIcon } from 'lucide-react';

interface AIChatButtonProps {
    onSend?: (message: string) => Promise<void> | void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const MAX_HEIGHT = 200;

/**
 * Collapsed: text 'DFai' button in top-left of canvas
 * Expanded: prompt bar at top-center of screen, with send inside panel and close outside
 */
const AIChatButton: React.FC<AIChatButtonProps> = ({ onSend, open: controlledOpen, onOpenChange }) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = (val: boolean) => {
        if (controlledOpen !== undefined) onOpenChange?.(val);
        else setInternalOpen(val);
    };

    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    const resize = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
    };

    useEffect(() => { if (open) resize(); }, [open]);

    // Send handler
    const send = async () => {
        const trimmed = message.trim();
        if (!trimmed) return;
        setIsLoading(true);
        try {
            await onSend?.(trimmed);
            setMessage('');
        } finally {
            setIsLoading(false);
            setOpen(false);
        }
    };

    if (!open) {
        return (
            <div className="absolute top-4 left-4 z-20">
                <motion.button
                    className="w-12 h-12 bg-dominofy-light-panel dark:bg-dominofy-dark-panel
                           text-dominofy-light-text dark:text-dominofy-dark-text
                           font-semibold rounded-full flex items-center justify-center
                           focus:outline-none
                           border-2 border-blue-500
                           ring-1 ring-gray-200 dark:ring-gray-700
                           shadow-[0_10px_20px_rgba(0,0,0,0.25)]"
                    onClick={() => setOpen(true)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    AI
                </motion.button>
            </div>
        );
    }


    // Expanded UI: panel with send inside, close outside
    const expandedUI = (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 inline-flex items-center gap-2">
            {/* Panel container with textarea and send button */}
            <div className="max-w-3xl w-[80vw]
                      bg-white border border-gray-200 rounded-md
                      ring-1 ring-gray-200 dark:ring-gray-700
                      shadow-[0_10px_20px_rgba(0,0,0,0.25)]
                      p-4 flex items-center gap-4
                      dark:bg-gray-800 dark:border-gray-700">                <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder="Lets automate..."
                    value={message}
                    onChange={e => { setMessage(e.target.value); resize(); }}
                    onInput={resize}
                    className="flex-1 bg-transparent focus:outline-none resize-none text-gray-700 placeholder-gray-400 dark:text-gray-200 dark:placeholder-gray-500"
                    style={{ maxHeight: `${MAX_HEIGHT}px` }}
                />
                <motion.button
                    disabled={isLoading}
                    onClick={send}
                    className="p-3 bg-black text-white rounded-full shadow-md focus:outline-none transition hover:bg-blue-700 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    {isLoading ? (
                        <PauseIcon size={20} className="animate-pulse" />
                    ) : (
                        <ArrowUp size={20} />
                    )}
                </motion.button>
            </div>
            {/* Close button outside panel */}
            <motion.button
                className="p-3 bg-white text-gray-600 rounded-full shadow-lg focus:outline-none dark:bg-gray-800 dark:text-gray-200"
                onClick={() => setOpen(false)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                <FiX size={20} />
            </motion.button>
        </div>
    );

    return ReactDOM.createPortal(expandedUI, document.body);
};

export default AIChatButton;
