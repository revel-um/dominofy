"use client"

import * as React from "react"
import { DatePicker, parseDate } from "@ark-ui/react/date-picker"
import { Portal } from "@ark-ui/react/portal"
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react"

import { cn } from "@/lib/utils"

type DateTimeRangePickerProps = {
  label?: string
  dateValue?: string
  startValue?: string
  endValue?: string
  onDateChange?: (value: string) => void
  onStartChange?: (value: string) => void
  onEndChange?: (value: string) => void
  disabled?: boolean
  dateConnected?: boolean
  startConnected?: boolean
  endConnected?: boolean
  datePin?: React.ReactNode
  startPin?: React.ReactNode
  endPin?: React.ReactNode
  className?: string
}

function extractDatePart(value?: string) {
  if (!value) return ""
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch?.[1]) return isoMatch[1]

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function extractTimePart(value?: string) {
  if (!value) return ""
  const match = value.match(/T(\d{2}:\d{2})/)
  return match?.[1] ?? ""
}

function composeDateTime(datePart: string, timePart: string) {
  if (!datePart || !timePart) return ""
  return `${datePart}T${timePart}:00`
}

function fallbackDate(startValue?: string, endValue?: string) {
  const fromStart = extractDatePart(startValue)
  if (fromStart) return fromStart
  const fromEnd = extractDatePart(endValue)
  if (fromEnd) return fromEnd
  return ""
}

function fallbackTime(value: string | undefined, fallback: string) {
  return extractTimePart(value) || fallback
}

function formatDateLabel(datePart: string) {
  if (!datePart) return "Pick date"
  const date = new Date(`${datePart}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "Pick date"
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date)
}

function dateValueToIso(value: { year: number; month: number; day: number } | undefined) {
  if (!value) return ""
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`
}

export function DateTimeRangePicker({
  label = "Date",
  dateValue = "",
  startValue = "",
  endValue = "",
  onDateChange,
  onStartChange,
  onEndChange,
  disabled = false,
  dateConnected = false,
  startConnected = false,
  endConnected = false,
  datePin,
  startPin,
  endPin,
  className,
}: DateTimeRangePickerProps) {
  const startTimeInputRef = React.useRef<HTMLInputElement | null>(null)
  const endTimeInputRef = React.useRef<HTMLInputElement | null>(null)
  const [selectedDate, setSelectedDate] = React.useState(() => fallbackDate(startValue, endValue))
  const [startTime, setStartTime] = React.useState(() => fallbackTime(startValue, "09:00"))
  const [endTime, setEndTime] = React.useState(() => fallbackTime(endValue, "10:00"))

  React.useEffect(() => {
    const nextDate = extractDatePart(dateValue) || fallbackDate(startValue, endValue)
    const nextStartTime = fallbackTime(startValue, "09:00")
    const nextEndTime = fallbackTime(endValue, "10:00")

    setSelectedDate((previous) => (previous === nextDate ? previous : nextDate))
    setStartTime((previous) => (previous === nextStartTime ? previous : nextStartTime))
    setEndTime((previous) => (previous === nextEndTime ? previous : nextEndTime))
  }, [dateValue, startValue, endValue])

  const pickerValue = React.useMemo(
    () => {
      if (!selectedDate) return undefined
      try {
        return [parseDate(selectedDate)]
      } catch {
        return undefined
      }
    },
    [selectedDate],
  )

  const disableDate = disabled || dateConnected
  const disableStart = disabled || startConnected
  const disableEnd = disabled || endConnected

  const openNativePicker = (input: HTMLInputElement | null) => {
    if (!input || input.disabled) return
    input.focus()
    if (typeof input.showPicker === "function") {
      input.showPicker()
    }
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      <DatePicker.Root
        value={pickerValue}
        onValueChange={(details) => {
          const nextDate = dateValueToIso(details.value[0] as { year: number; month: number; day: number } | undefined)
          setSelectedDate(nextDate)
          onDateChange?.(nextDate)
          if (!startConnected) {
            onStartChange?.(composeDateTime(nextDate, startTime))
          }
          if (!endConnected) {
            onEndChange?.(composeDateTime(nextDate, endTime))
          }
        }}
        closeOnSelect
        positioning={{ placement: "bottom-start" }}
      >
        <DatePicker.Control className="space-y-3">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
              {label}
            </div>
            <div className="relative">
              <div className="flex items-center gap-2">
                {datePin}
                <div className="relative flex-1">
                  <DatePicker.Trigger
                    disabled={disableDate}
                    className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 pr-12 text-left text-sm font-medium text-slate-900 shadow-sm transition hover:bg-dominofy-light-surface disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-dominofy-dark-surface dark:text-slate-100 dark:hover:bg-dominofy-dark-surface"
                  >
                    <Calendar className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-300" />
                    <span className="truncate">{startConnected || endConnected ? "Connected" : formatDateLabel(selectedDate)}</span>
                  </DatePicker.Trigger>

                  {!disabled && !startConnected && !endConnected && (selectedDate || startValue || endValue) ? (
                    <DatePicker.ClearTrigger
                      className="absolute right-2 top-1/2 rounded-xl border border-transparent p-2 text-slate-500 transition hover:bg-red-100 hover:text-red-500 dark:text-slate-300 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                      onClick={() => {
                        setSelectedDate("")
                        onDateChange?.("")
                        onStartChange?.("")
                        onEndChange?.("")
                      }}
                      style={{ transform: "translateY(-50%)" }}
                    >
                      <X className="h-4 w-4" />
                    </DatePicker.ClearTrigger>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-full text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
              Start Time
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              {startPin}
              <div
                className="flex min-h-12 flex-1 items-center rounded-2xl border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 shadow-sm dark:border-slate-600 dark:bg-dominofy-dark-surface"
                onClick={() => openNativePicker(startTimeInputRef.current)}
              >
                <input
                  ref={startTimeInputRef}
                  type="time"
                  value={startTime}
                  onChange={(event) => {
                    const nextTime = event.target.value
                    setStartTime(nextTime)
                    if (!startConnected) {
                      onStartChange?.(composeDateTime(selectedDate || fallbackDate(startValue, endValue), nextTime))
                    }
                  }}
                  disabled={disableStart}
                  className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none disabled:cursor-not-allowed dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-full text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50">
              End Time
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              {endPin}
              <div
                className="flex min-h-12 flex-1 items-center rounded-2xl border border-slate-300/80 bg-dominofy-light-surface px-4 py-3 shadow-sm dark:border-slate-600 dark:bg-dominofy-dark-surface"
                onClick={() => openNativePicker(endTimeInputRef.current)}
              >
                <input
                  ref={endTimeInputRef}
                  type="time"
                  value={endTime}
                  onChange={(event) => {
                    const nextTime = event.target.value
                    setEndTime(nextTime)
                    if (!endConnected) {
                      onEndChange?.(composeDateTime(selectedDate || fallbackDate(startValue, endValue), nextTime))
                    }
                  }}
                  disabled={disableEnd}
                  className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none disabled:cursor-not-allowed dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </DatePicker.Control>

        <Portal>
          <DatePicker.Positioner>
            <DatePicker.Content className="z-[100] mt-2 w-[22rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex gap-2">
                <DatePicker.YearSelect className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                <DatePicker.MonthSelect className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
              </div>

              <DatePicker.View view="day">
                <DatePicker.Context>
                  {(datePicker) => (
                    <>
                      <DatePicker.ViewControl className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                        <DatePicker.PrevTrigger className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <ChevronLeft className="h-4 w-4" />
                        </DatePicker.PrevTrigger>
                        <DatePicker.ViewTrigger className="cursor-pointer rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <DatePicker.RangeText />
                        </DatePicker.ViewTrigger>
                        <DatePicker.NextTrigger className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <ChevronRight className="h-4 w-4" />
                        </DatePicker.NextTrigger>
                      </DatePicker.ViewControl>

                      <DatePicker.Table className="w-full text-center text-sm">
                        <DatePicker.TableHead>
                          <DatePicker.TableRow>
                            {datePicker.weekDays.map((weekDay, id) => (
                              <DatePicker.TableHeader
                                key={id}
                                className="py-1 text-slate-500 dark:text-slate-400"
                              >
                                {weekDay.short}
                              </DatePicker.TableHeader>
                            ))}
                          </DatePicker.TableRow>
                        </DatePicker.TableHead>
                        <DatePicker.TableBody>
                          {datePicker.weeks.map((week, id) => (
                            <DatePicker.TableRow key={id}>
                              {week.map((day, cellId) => (
                                <DatePicker.TableCell key={cellId} value={day}>
                                  <DatePicker.TableCellTrigger className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 data-[selected]:bg-blue-600 data-[selected]:text-white dark:hover:bg-blue-900/50">
                                    {day.day}
                                  </DatePicker.TableCellTrigger>
                                </DatePicker.TableCell>
                              ))}
                            </DatePicker.TableRow>
                          ))}
                        </DatePicker.TableBody>
                      </DatePicker.Table>
                    </>
                  )}
                </DatePicker.Context>
              </DatePicker.View>

              <DatePicker.View view="month">
                <DatePicker.Context>
                  {(datePicker) => (
                    <>
                      <DatePicker.ViewControl className="mb-2 flex items-center justify-between">
                        <DatePicker.PrevTrigger className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <ChevronLeft className="h-4 w-4" />
                        </DatePicker.PrevTrigger>
                        <DatePicker.ViewTrigger className="cursor-pointer rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <DatePicker.RangeText />
                        </DatePicker.ViewTrigger>
                        <DatePicker.NextTrigger className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <ChevronRight className="h-4 w-4" />
                        </DatePicker.NextTrigger>
                      </DatePicker.ViewControl>
                      <DatePicker.Table className="w-full text-sm">
                        <DatePicker.TableBody>
                          {datePicker.getMonthsGrid({ columns: 4, format: "short" }).map((months, id) => (
                            <DatePicker.TableRow key={id}>
                              {months.map((month, monthId) => (
                                <DatePicker.TableCell key={monthId} value={month.value}>
                                  <DatePicker.TableCellTrigger className="rounded-lg px-2 py-1 hover:bg-blue-100 data-[selected]:bg-blue-600 data-[selected]:text-white dark:hover:bg-blue-900/50">
                                    {month.label}
                                  </DatePicker.TableCellTrigger>
                                </DatePicker.TableCell>
                              ))}
                            </DatePicker.TableRow>
                          ))}
                        </DatePicker.TableBody>
                      </DatePicker.Table>
                    </>
                  )}
                </DatePicker.Context>
              </DatePicker.View>

              <DatePicker.View view="year">
                <DatePicker.Context>
                  {(datePicker) => (
                    <>
                      <DatePicker.ViewControl className="mb-2 flex items-center justify-between">
                        <DatePicker.PrevTrigger className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <ChevronLeft className="h-4 w-4" />
                        </DatePicker.PrevTrigger>
                        <DatePicker.ViewTrigger className="cursor-pointer rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <DatePicker.RangeText />
                        </DatePicker.ViewTrigger>
                        <DatePicker.NextTrigger className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                          <ChevronRight className="h-4 w-4" />
                        </DatePicker.NextTrigger>
                      </DatePicker.ViewControl>
                      <DatePicker.Table className="w-full text-sm">
                        <DatePicker.TableBody>
                          {datePicker.getYearsGrid({ columns: 4 }).map((years, id) => (
                            <DatePicker.TableRow key={id}>
                              {years.map((year, yearId) => (
                                <DatePicker.TableCell key={yearId} value={year.value}>
                                  <DatePicker.TableCellTrigger className="rounded-lg px-2 py-1 hover:bg-blue-100 data-[selected]:bg-blue-600 data-[selected]:text-white dark:hover:bg-blue-900/50">
                                    {year.label}
                                  </DatePicker.TableCellTrigger>
                                </DatePicker.TableCell>
                              ))}
                            </DatePicker.TableRow>
                          ))}
                        </DatePicker.TableBody>
                      </DatePicker.Table>
                    </>
                  )}
                </DatePicker.Context>
              </DatePicker.View>
            </DatePicker.Content>
          </DatePicker.Positioner>
        </Portal>
      </DatePicker.Root>
    </div>
  )
}

export const Basic = () => {
  const [startValue, setStartValue] = React.useState("2026-04-10T04:00:00")
  const [endValue, setEndValue] = React.useState("2026-04-10T05:00:00")

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <DateTimeRangePicker
        startValue={startValue}
        endValue={endValue}
        onStartChange={setStartValue}
        onEndChange={setEndValue}
      />
    </div>
  )
}
