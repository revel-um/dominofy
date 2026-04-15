"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  ...props
}: CalendarProps) {
  const defaultClassNames = {
    months: "relative flex flex-col sm:flex-row gap-4",
    month: "w-full",
    month_caption: "relative mx-10 mb-1 flex h-9 items-center justify-center z-20",
    caption_label: "text-sm font-semibold text-sky-700 dark:text-sky-300",
    nav: "absolute top-0 flex w-full justify-between z-10",
    button_previous: cn(
      buttonVariants({ variant: "ghost" }),
      "size-9 p-0 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:text-sky-300 dark:hover:bg-sky-500/10 dark:hover:text-sky-200",
    ),
    button_next: cn(
      buttonVariants({ variant: "ghost" }),
      "size-9 p-0 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:text-sky-300 dark:hover:bg-sky-500/10 dark:hover:text-sky-200",
    ),
    weekday: "size-9 p-0 text-xs font-medium text-muted-foreground/80 dark:text-white/70",
    day_button:
      "relative flex size-9 items-center justify-center whitespace-nowrap rounded-lg p-0 text-foreground dark:text-white outline-offset-2 group-[[data-selected]:not(.range-middle)]:[transition-property:color,background-color,border-radius,box-shadow] group-[[data-selected]:not(.range-middle)]:duration-150 focus:outline-none group-data-[disabled]:pointer-events-none focus-visible:z-10 hover:bg-accent hover:text-foreground dark:hover:text-white group-data-[selected]:bg-primary hover:text-foreground group-data-[selected]:text-primary-foreground dark:group-data-[selected]:bg-sky-500 dark:group-data-[selected]:text-slate-950 group-data-[disabled]:text-foreground/30 dark:group-data-[disabled]:text-white/25 group-data-[disabled]:line-through group-data-[outside]:text-foreground/30 dark:group-data-[outside]:text-white/45 group-data-[outside]:group-data-[selected]:text-primary-foreground dark:group-data-[outside]:group-data-[selected]:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 group-[.range-start:not(.range-end)]:rounded-e-none group-[.range-end:not(.range-start)]:rounded-s-none group-[.range-middle]:rounded-none group-data-[selected]:group-[.range-middle]:bg-accent group-data-[selected]:group-[.range-middle]:text-foreground dark:group-data-[selected]:group-[.range-middle]:bg-sky-400/30 dark:group-data-[selected]:group-[.range-middle]:text-white",
    day: "group size-9 px-0 text-sm dark:text-white",
    range_start: "range-start dark:bg-sky-500 dark:text-slate-950",
    range_end: "range-end dark:bg-sky-500 dark:text-slate-950",
    range_middle: "range-middle dark:bg-sky-400/30 dark:text-white",
    today:
      "*:after:pointer-events-none *:after:absolute *:after:bottom-1 *:after:start-1/2 *:after:z-10 *:after:size-[3px] *:after:-translate-x-1/2 *:after:rounded-full *:after:bg-primary [&[data-selected]:not(.range-middle)>*]:after:bg-background [&[data-disabled]>*]:after:bg-foreground/30 *:after:transition-colors",
    outside: "text-muted-foreground dark:text-white/45 data-selected:bg-accent/50 data-selected:text-muted-foreground dark:data-selected:bg-sky-400/20 dark:data-selected:text-white",
    hidden: "invisible",
    week_number: "size-9 p-0 text-xs font-medium text-muted-foreground/80",
  };

  const mergedClassNames: typeof defaultClassNames = Object.keys(defaultClassNames).reduce(
    (acc, key) => ({
      ...acc,
      [key]: classNames?.[key as keyof typeof classNames]
        ? cn(
            defaultClassNames[key as keyof typeof defaultClassNames],
            classNames[key as keyof typeof classNames],
          )
        : defaultClassNames[key as keyof typeof defaultClassNames],
    }),
    {} as typeof defaultClassNames,
  );

  const defaultComponents = {
    Chevron: (props: any) => {
      if (props.orientation === "left") {
        return <ChevronLeft size={16} strokeWidth={2} {...props} aria-hidden="true" />;
      }
      return <ChevronRight size={16} strokeWidth={2} {...props} aria-hidden="true" />;
    },
  };

  const mergedComponents = {
    ...defaultComponents,
    ...userComponents,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-fit", className)}
      classNames={mergedClassNames}
      components={mergedComponents}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
