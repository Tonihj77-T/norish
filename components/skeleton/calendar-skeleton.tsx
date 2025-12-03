"use client";

import DayTimelineSkeleton from "./day-timeline-skeleton";
import MonthlyCalendarSkeleton from "./monthly-calendar-skeleton";

export default function CalendarSkeleton() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col md:mx-auto md:max-w-7xl md:p-6 lg:p-8">
      {/* Title */}
      <h1 className="mb-4 shrink-0 px-4 text-2xl font-bold md:px-0">Calendar</h1>

      {/* Mobile */}
      <div className="flex min-h-0 w-full flex-1 flex-col md:hidden">
        <DayTimelineSkeleton />
      </div>

      {/* Desktop */}
      <div className="hidden min-h-0 w-full flex-1 gap-6 md:grid md:grid-cols-2">
        <div className="h-full">
          <MonthlyCalendarSkeleton />
        </div>
        <div className="flex h-full min-h-0 flex-col">
          <DayTimelineSkeleton />
        </div>
      </div>
    </div>
  );
}
