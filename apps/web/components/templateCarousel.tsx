import { FiLayers, FiChevronLeft, FiChevronRight, FiPlay } from "react-icons/fi";
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
  const [isAutoSwitchPaused, setIsAutoSwitchPaused] = useState(false);
  const [needsManualResume, setNeedsManualResume] = useState(false);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSwitchPausedRef = useRef(isAutoSwitchPaused);

  const updateAutoSwitchPaused = (value: boolean) => {
    isAutoSwitchPausedRef.current = value;
    setIsAutoSwitchPaused(value);
  };

  useEffect(() => {
    isAutoSwitchPausedRef.current = isAutoSwitchPaused;
  }, [isAutoSwitchPaused]);

  const clearTimers = () => {
    if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
  };

  const startAutoScroll = () => {
    const isPaused = isAutoSwitchPausedRef.current;
    if (isPaused) {
      return;
    }
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

  const resumeAutoScroll = () => {
    setNeedsManualResume(false);
    updateAutoSwitchPaused(false);
    startAutoScroll();
  };

  const handleManualTemplateChange = () => {
    if (needsManualResume) {
      resumeAutoScroll();
    } else {
      // For regular manual switches, give the user a brief pause before auto-scroll resumes
      delayAutoScroll();
    }
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % templates.length);
    handleManualTemplateChange();
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + templates.length) % templates.length);
    handleManualTemplateChange();
  };

  // Handle viewport changes from canvas
  const handleViewportChange = () => {
    if (needsManualResume) {
      return;
    }

    // Pause auto-switch until the user manually switches templates
    updateAutoSwitchPaused(true);
    setNeedsManualResume(true);
    clearTimers();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRenderedOnce]);

  if (templates.length === 0 || !templates[currentIndex]) {
    return (
      <div className="relative flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden rounded-[30px] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(241,245,249,0.92))] px-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(180deg,_rgba(15,23,42,0.95),_rgba(2,6,23,0.9))]">
        <div className="space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-sky-600 shadow-sm dark:bg-white/10 dark:text-sky-200">
            <FiLayers className="h-7 w-7" />
          </div>
          <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
            Awesome templates coming your way!
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Stay tuned. Template journeys will appear here as soon as they are ready.
          </p>
        </div>
      </div>
    );
  }

  const { nodes, edges } = templates[currentIndex];

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-[30px] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_36%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.92))] shadow-[0_24px_60px_rgba(15,23,42,0.12)] transition-all duration-700 ease-in-out dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_36%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.9))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-6 py-5">
        <div className="pointer-events-auto rounded-full border border-white/60 bg-white/75 px-4 py-2 text-slate-900 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-950/45 dark:text-white">
          <div className="flex items-center gap-2">
            <FiLayers className="h-5 w-5 text-sky-600 dark:text-sky-300" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Templates
              </p>
              <p className="text-sm font-medium">Explore ready-made flow starters</p>
            </div>
          </div>
        </div>
        <div className="pointer-events-auto rounded-full border border-white/60 bg-white/75 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-200">
          {currentIndex + 1} / {templates.length}
        </div>
      </div>

      <div key={currentIndex} className="h-full w-full animate-fade-in-slide">
        <Canvas
          nodes={nodes}
          edges={edges}
          readonly={readonly}
          id={id}
          setNodes={() => {}}
          setEdges={() => {}}
          onViewportChange={handleViewportChange}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-5 py-4">
        <div className="rounded-full border border-white/70 bg-white/80 px-3 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-400">
          {isAutoSwitchPaused ? "Manual explore" : "Auto rotating"}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-2 py-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-950/50">
          <button
            onClick={goToPrev}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Previous template"
          >
            <FiChevronLeft className="h-5 w-5" />
          </button>

          {isAutoSwitchPaused && (
            <button
              type="button"
              onClick={goToNext}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white transition hover:bg-sky-600"
              aria-label="Resume auto-scroll"
            >
              <FiPlay className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={goToNext}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Next template"
          >
            <FiChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
