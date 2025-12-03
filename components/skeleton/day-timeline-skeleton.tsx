"use client";
import { Skeleton } from "@heroui/react";

export default function DayTimelineSkeleton() {
  return (
    <div className="space-y-4 p-3">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="rounded-medium h-10 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
