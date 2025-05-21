import { FiLayers, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import type { Node, Edge } from "reactflow";
import Canvas from "./canvas";
import { useEffect, useRef, useState } from "react";

interface Template {
    nodes: Node[];
    edges: Edge[];
}

interface TemplatesCanvasProps {
    templates: Template[];
    readonly?: boolean;
    id?: string;
}

export default function TemplatesCanvas({
    templates,
    readonly = true,
    id = "dashboard-template",
}: TemplatesCanvasProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [hasRenderedOnce, setHasRenderedOnce] = useState(false);
    const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const clearTimers = () => {
        if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
        if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
    };

    const startAutoScroll = () => {
        clearTimers();
        scrollIntervalRef.current = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % templates.length);
        }, 5000);
    };

    const delayAutoScroll = () => {
        clearTimers();
        delayTimeoutRef.current = setTimeout(() => {
            startAutoScroll();
        }, 20000);
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev + 1) % templates.length);
        delayAutoScroll();
    };

    const goToPrev = () => {
        setCurrentIndex((prev) => (prev - 1 + templates.length) % templates.length);
        delayAutoScroll();
    };

    useEffect(() => {
        if (templates.length > 0 && !hasRenderedOnce) {
            setHasRenderedOnce(true);
        }
    }, [templates.length, hasRenderedOnce]);

    useEffect(() => {
        if (hasRenderedOnce) {
            startAutoScroll();
        }
        return () => clearTimers();
    }, [hasRenderedOnce]);

    if (templates.length === 0 || !templates[currentIndex]) {
        return (
            <div className="w-[70%] h-full rounded-2xl bg-white dark:bg-gray-800 shadow-md flex items-center justify-center text-center px-6">
                <div className="space-y-2">
                    <FiLayers className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto" />
                    <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
                        Awesome templates coming your way!
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                        Stay tuned — we’re cooking up something special for you.
                    </p>
                </div>
            </div>
        );
    }

    const { nodes, edges } = templates[currentIndex];
    return (
        <div className="w-full rounded-2xl bg-white dark:bg-gray-800 shadow-md overflow-hidden relative transition-all duration-700 ease-in-out">
            {/* Overlay label */}
            <div className="absolute top-0 left-0 px-6 py-4 z-10">
                <div className="rounded-full px-4 py-2 bg-gray-400/30 dark:bg-black/30 backdrop-blur-sm flex items-center gap-x-2 text-black dark:text-white">
                    <FiLayers className="w-5 h-5" />
                    <p className="text-sm font-medium">Templates</p>
                </div>
            </div>

            {/* Canvas View */}
            <div
                key={currentIndex}
                className="w-full h-full animate-fade-in-slide"
            >
                <Canvas
                    nodes={nodes}
                    edges={edges}
                    readonly={readonly}
                    id={id}
                    setNodes={() => { }}
                    setEdges={() => { }}
                />
            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 w-full px-4 py-3 flex justify-between items-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
                <button
                    onClick={goToPrev}
                    className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition"
                >
                    <FiChevronLeft className="w-6 h-6" />
                </button>

                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {currentIndex + 1} / {templates.length}
                </p>

                <button
                    onClick={goToNext}
                    className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition"
                >
                    <FiChevronRight className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}
