"use client";

import { Card, Skeleton } from "@heroui/react";

export default function GroceriesSkeleton() {
  return (
    <>
      <Card className="space-y-3 p-4" shadow="sm">
        <h1 className="font-bold">To buy</h1>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full rounded" />
        ))}
      </Card>

      <Card className="space-y-3 p-4" shadow="sm">
        <h1 className="font-bold">Bought</h1>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full rounded" />
        ))}
      </Card>
    </>
  );
}
