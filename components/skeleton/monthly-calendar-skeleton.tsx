"use client";
import { Skeleton } from "@heroui/react";

export default function MonthlyCalendarSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4">
      <Skeleton className="rounded-medium h-8 w-full" />
      <Skeleton className="rounded-large h-[420px] w-full" />
    </div>
  );
}
