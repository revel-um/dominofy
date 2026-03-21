"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ToolbarButton {
  label: string;
  icon?: ReactNode;
  count?: number;
  onClick?: () => void;
  dropdownItems?: string[];
  onDropdownItemClick?: (item: string) => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  showLabel?: boolean;
}

interface ActionToolbarProps {
  buttons: ToolbarButton[];
  compact?: boolean;
  className?: string;
}

export function ActionToolbar({
  buttons,
  compact = false,
  className = "",
}: ActionToolbarProps) {
  const [activeStates, setActiveStates] = useState<boolean[]>(buttons.map((btn) => !!btn.active));

  useEffect(() => {
    setActiveStates(buttons.map((btn) => !!btn.active));
  }, [buttons]);

  const handleToggle = (index: number, onClick?: () => void) => {
    const updated = [...activeStates];
    updated[index] = !updated[index];
    setActiveStates(updated);
    onClick?.();
  };

  return (
    <div
      className={cn(
        "relative z-0 flex flex-wrap items-center gap-1 rounded-2xl border border-muted bg-gradient-to-b from-background to-muted/30 p-1 shadow-sm",
        className,
      )}
    >
      {buttons.map((btn, index) => {
        const isActive = activeStates[index];
        const showLabel = btn.showLabel ?? true;

        const buttonClasses = cn(
          "flex h-9 items-center gap-2 rounded-xl px-3 transition-all duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          btn.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
          btn.className,
        );

        if (btn.dropdownItems) {
          return (
            <div key={index} className="flex items-center">
              <Button
                onClick={() => handleToggle(index, btn.onClick)}
                variant="ghost"
                disabled={btn.disabled}
                title={btn.title}
                aria-label={btn.ariaLabel ?? btn.label}
                className={cn(buttonClasses, compact && "px-2")}
              >
                {btn.icon}
                {showLabel && <span className="font-medium">{btn.label}</span>}
                {btn.count !== undefined && (
                  <Badge
                    variant={isActive ? "secondary" : "outline"}
                    className="text-xs font-mono -me-1"
                  >
                    {btn.count}
                  </Badge>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    disabled={btn.disabled}
                    className="ml-0.5 h-9 w-8 rounded-xl hover:bg-muted/80"
                    aria-label={`${btn.ariaLabel ?? btn.label} options`}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {btn.dropdownItems.map((item, i) => (
                    <DropdownMenuItem key={i} onClick={() => btn.onDropdownItemClick?.(item)}>
                      {item}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        }

        return (
          <Button
            key={index}
            onClick={() => handleToggle(index, btn.onClick)}
            variant="ghost"
            disabled={btn.disabled}
            title={btn.title}
            aria-label={btn.ariaLabel ?? btn.label}
            className={cn(buttonClasses, compact && "px-2")}
          >
            {btn.icon}
            {showLabel && <span className="font-medium">{btn.label}</span>}
            {btn.count !== undefined && (
              <Badge
                variant={isActive ? "secondary" : "outline"}
                className="text-xs font-mono -me-1"
              >
                {btn.count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
