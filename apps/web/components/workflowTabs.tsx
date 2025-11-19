// src/components/workflowTabs.tsx
"use client";

import { Plus, X } from "lucide-react";

export type WorkflowTabMeta = {
  id: string;
  name: string;
};

type WorkflowTabsProps = {
  tabs: WorkflowTabMeta[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab?: () => void; // optional (you can wire later)
};

export function WorkflowTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
}: WorkflowTabsProps) {
  return (
    <div className="flex items-center border-b border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-2 min-h-[48px] flex-shrink-0">
      <div className="flex flex-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group mr-1 flex items-center rounded-t-md px-3 py-2 text-sm whitespace-nowrap flex-shrink-0
                ${
                  isActive
                    ? "bg-white dark:bg-gray-900 font-medium text-slate-900 dark:text-gray-100 border-x border-t border-slate-200 dark:border-gray-600"
                    : "bg-transparent text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700"
                }`}
            >
              <span className="truncate max-w-[140px]">
                {tab.name}
              </span>
              {tabs.length > 1 && (
                <X
                  className="ml-2 h-3 w-3 opacity-50 group-hover:opacity-100 text-slate-400 dark:text-gray-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {onAddTab && (
        <button
          onClick={onAddTab}
          className="ml-2 flex items-center rounded-md border border-dashed border-slate-300 dark:border-gray-600 px-2 py-1 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 flex-shrink-0"
        >
          <Plus className="mr-1 h-3 w-3" />
          New tab
        </button>
      )}
    </div>
  );
}
