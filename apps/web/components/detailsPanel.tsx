import React, { useState, useRef } from 'react';
import { FiSettings, FiPlay } from 'react-icons/fi';
import { useDomino } from '../contexts/dominoContext';
import { Node } from 'reactflow';


export default function DetailsPanel({selectedNode}: { selectedNode: Node | undefined }) {
    const { runDominosFlow } = useDomino();

    const MIN_WIDTH = 240;
    const MAX_WIDTH = 480;
    const [width, setWidth] = useState(MIN_WIDTH);
    const isDragging = useRef(false);

    const handleMouseDown = () => {
        isDragging.current = true;
        document.body.classList.add('select-none');
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: { clientX: number; }) => {
        if (!isDragging.current) return;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
        setWidth(newWidth);
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        document.body.classList.remove('select-none');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className="absolute top-0 right-0 h-full z-10 bg-dominofy-light-panel dark:bg-dominofy-dark-panel p-4 flex flex-col justify-between"
            style={{ width }}
        >
            <div>
                <div className="flex justify-between items-center w-full mb-4">
                    <h2 className="text-lg font-semibold">Details</h2>

                    <div className="flex items-center gap-3">
                        <FiPlay
                            onClick={runDominosFlow}
                            className="text-2xl cursor-pointer text-dominofy-light-text dark:text-dominofy-dark-text hover:opacity-80"
                        />
                        <button
                            onClick={() => alert('Deploy button clicked')}
                            className="px-4 py-1.5 rounded text-sm font-medium text-white bg-dominofy-light-accent dark:bg-dominofy-dark-accent hover:opacity-90 transition"
                        >
                            Deploy
                        </button>
                    </div>
                </div>
                <div className="p-3 rounded bg-dominofy-light-surface dark:bg-dominofy-dark-surface mb-4">
                    <p className="text-sm">Details about selected node...</p>
                </div>
            </div>

            {/* Bottom right floating settings icon */}
            <div className="flex justify-end">
                <FiSettings className="text-2xl cursor-pointer text-dominofy-light-text dark:text-dominofy-dark-text" />
            </div>

            {/* Resize Handle */}
            <div
                onMouseDown={handleMouseDown}
                className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize bg-transparent"
            />
        </div>
    );
}
