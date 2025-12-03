"use client";

import { Skeleton } from "@heroui/react";

export default function RecipeSkeletonMobile() {
  return (
    <div className="flex w-full flex-col">
      {/* Hero Image */}
      <Skeleton className="h-[45vh] min-h-[320px] w-full rounded-none" />

      {/* Main Content Card - overlapping hero */}
      <div className="bg-content1 relative z-10 mx-3 -mt-6 overflow-visible rounded-xl shadow-sm">
        <div className="space-y-4 px-4 py-5">
          {/* Back link */}
          <Skeleton className="h-4 w-32 rounded-md" />

          {/* Divider */}
          <div className="bg-default-200 h-px w-full" />

          {/* Title */}
          <Skeleton className="h-7 w-3/4 rounded-lg" />

          {/* Time info */}
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Ingredients Card */}
      <div className="bg-content1 mx-3 mt-4 rounded-xl shadow-sm">
        <div className="space-y-4 px-4 py-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
          <div className="bg-default-200 h-px w-full" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>

      {/* Steps Card */}
      <div className="bg-content1 mx-3 mt-4 rounded-xl shadow-sm">
        <div className="space-y-3 px-4 py-5">
          <Skeleton className="h-6 w-16 rounded-lg" />
          <div className="bg-default-200 h-px w-full" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-6 w-6 flex-shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pb-5" />
    </div>
  );
}
