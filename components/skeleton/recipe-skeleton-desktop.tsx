"use client";

import { Skeleton } from "@heroui/react";

export default function RecipeSkeletonDesktop() {
  return (
    <div className="flex flex-col space-y-6 px-6 pb-10">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded-md" />
      </div>

      {/* Header section - matches Card with grid-cols-2 */}
      <div className="bg-content1 overflow-hidden rounded-2xl shadow-md">
        <div className="grid grid-cols-2">
          {/* Image Section */}
          <Skeleton className="aspect-[3/2] w-full rounded-none" />

          {/* Info Section */}
          <div className="flex flex-col justify-between p-8">
            <div className="flex flex-col gap-4">
              {/* Title and description */}
              <div className="flex w-full items-start justify-between">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-9 w-3/4 rounded-lg" />
                  <Skeleton className="h-4 w-full max-w-md rounded-md" />
                  <Skeleton className="h-4 w-2/3 max-w-md rounded-md" />
                </div>
                {/* Actions button placeholder */}
                <Skeleton className="ml-4 h-10 w-10 flex-shrink-0 rounded-lg" />
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>

            {/* Time info */}
            <div className="flex items-center gap-4 pt-6">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Content grid - matches grid-cols-5 with col-span-2 and col-span-3 */}
      <div className="grid grid-cols-5 gap-6">
        {/* Ingredients */}
        <div className="bg-content1 col-span-2 rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-6 w-28 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full rounded-md" />
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="bg-content1 col-span-3 rounded-2xl p-6">
          <Skeleton className="mb-4 h-6 w-16 rounded-lg" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
