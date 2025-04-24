import React, { useState, useRef } from 'react';
import dominos from '../dominos/dominos';

export default function DominosPanel() {
    const MIN_WIDTH = 240;
    const MAX_WIDTH = 480;
    const [width, setWidth] = useState(MIN_WIDTH);
    const isDragging = useRef(false);

    const handleMouseDown = () => {
        isDragging.current = true;
        document.body.classList.add('select-none'); // ✨ Prevents text selection
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: { clientX: number; }) => {
        if (!isDragging.current) return;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
        setWidth(newWidth);
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        document.body.classList.add('select-none'); // ✨ Prevents text selection
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className="absolute top-0 left-0 h-full z-10 bg-dominofy-light-panel dark:bg-dominofy-dark-panel p-4 overflow-y-auto"
            style={{ width }}
        >
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Dominos</h2>
                <button
                    className="text-xs px-2 py-1 rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface"
                    onClick={() => {
                        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
                        document.documentElement.classList.toggle('dark');
                        localStorage.setItem('theme', newTheme);
                    }}
                >
                    🌓
                </button>
            </div>

            <input
                type="text"
                placeholder="Search dominos..."
                className="w-full px-3 py-2 mb-4 rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface text-sm"
            />

            {dominos.map(({ id, label, icon: Icon }) => (
                <div
                    key={id}
                    draggable={true}
                    onDragStart={(e) => {
                        e.dataTransfer.setData('application/reactflow', id);
                        e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="flex items-center gap-2 p-3 mb-3 bg-dominofy-light-surface dark:bg-dominofy-dark-surface rounded cursor-move hover:opacity-90 transition"
                >
                    <Icon className="text-lg text-dominofy-light-text dark:text-dominofy-dark-text" />
                    <span className="text-sm font-medium text-dominofy-light-text dark:text-dominofy-dark-text">
                        {label}
                    </span>
                </div>
            ))}
            {/* Resize Handle */}
            <div
                onMouseDown={handleMouseDown}
                className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize bg-transparent"
            />
        </div>
    );
}
