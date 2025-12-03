"use client";

import { useGroceriesContext } from "../context";

import PendingGroceries from "./pending-groceries";
import DoneGroceries from "./done-groceries";

import GroceriesSkeleton from "@/components/skeleton/groceries-skeleton";

export default function GroceriesList() {
  const { pendingGroceries, doneGroceries, isLoading } = useGroceriesContext();

  if (isLoading) return <GroceriesSkeleton />;

  return (
    <div className="space-y-6" id="tobuy-container">
      <PendingGroceries groceries={pendingGroceries} />
      <DoneGroceries groceries={doneGroceries} />
    </div>
  );
}
