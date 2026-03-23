"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrainCircuit, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

export interface AIThinkingBlockProps {
  title?: string;
  elapsedSeconds?: number;
  thoughtSummaries?: string[];
  status?: string;
  className?: string;
}

export default function AIThinkingBlock({
  title = "Dominofy AI is thinking",
  elapsedSeconds = 0,
  thoughtSummaries = [],
  status,
  className,
}: AIThinkingBlockProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const content = useMemo(() => thoughtSummaries.join("\n\n"), [thoughtSummaries]);
  const hasContent = content.trim().length > 0;

  useEffect(() => {
    if (!hasContent || !contentRef.current) {
      setScrollPosition(0);
      return;
    }

    const node = contentRef.current;
    const maxScroll = Math.max(node.scrollHeight - node.clientHeight, 0);

    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    if (maxScroll <= 0) return;

    scrollIntervalRef.current = setInterval(() => {
      setScrollPosition((prev) => {
        const next = prev + 1;
        return next >= maxScroll ? 0 : next;
      });
    }, 24);

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [hasContent, content]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
          <Sparkles className="h-3.5 w-3.5" />
          Live Reasoning
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] normal-case tracking-normal">
          <Loader size="xs" variant="muted" />
          <span>{title}</span>
          <span className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/5">
            {elapsedSeconds}s
          </span>
        </div>
      </div>

      <Card
        variant="outline"
        size="sm"
        className="border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50/60 shadow-[0_20px_50px_-28px_rgba(14,165,233,0.45)] dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/90"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white via-white/85 to-transparent dark:from-slate-950 dark:via-slate-950/85" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/85 to-transparent dark:from-slate-950 dark:via-slate-950/85" />

        <div
          ref={contentRef}
          className="relative h-[172px] overflow-hidden px-4 py-4"
          style={{ scrollBehavior: "auto" }}
        >
          {hasContent ? (
            <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {thoughtSummaries.map((summary, index) => (
                <div
                  key={`${index}-${summary.slice(0, 16)}`}
                  className="flex gap-3 rounded-2xl border border-slate-200/70 bg-white/85 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300">
                    <BrainCircuit className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                      Thought {index + 1}
                    </p>
                    <p className="whitespace-pre-wrap">{summary}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                <Loader size="xs" variant="muted" />
                <span>{status || "Preparing workflow context"}</span>
              </div>
              <div className="space-y-3">
                <div className="h-3 w-[92%] animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-[84%] animate-pulse rounded-full bg-slate-200/90 dark:bg-slate-800/90" />
                <div className="h-3 w-[73%] animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-800/80" />
                <div className="h-16 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="space-y-2">
                    <div className="h-2.5 w-24 animate-pulse rounded-full bg-sky-200/70 dark:bg-sky-900/40" />
                    <div className="h-2.5 w-[88%] animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-[76%] animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
