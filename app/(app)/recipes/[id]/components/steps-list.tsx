"use client";

import React, { useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";

import { useRecipeContext } from "../context";

export default function StepsList() {
  const { recipe } = useRecipeContext();
  const [done, setDone] = useState<Set<number>>(() => new Set());

  const toggle = (i: number) => {
    setDone((prev) => {
      const next = new Set(prev);

      if (next.has(i)) next.delete(i);
      else next.add(i);

      return next;
    });
  };

  const onKeyToggle = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(i);
    }
  };

  return (
    <ol className="mt-2 list-none space-y-4 text-sm leading-relaxed">
      {recipe?.steps
        .filter((s) => s.systemUsed === recipe.systemUsed)
        .sort((a, b) => a.order - b.order)
        .map((s, i) => {
          const isDone = done.has(i);

          return (
            <li key={i}>
              <div
                aria-pressed={isDone}
                className="grid cursor-pointer grid-cols-[1.5rem_1fr] items-start gap-3 select-none focus:outline-none"
                role="button"
                tabIndex={0}
                onClick={() => toggle(i)}
                onKeyDown={(e) => onKeyToggle(e, i)}
              >
                {isDone ? (
                  <CheckCircleIcon className="text-success h-5 w-5" />
                ) : (
                  <span className="text-default-600 w-6 text-center text-sm font-medium">
                    {i + 1}.
                  </span>
                )}
                <p
                  className={
                    (isDone ? "text-default-400 line-through " : "text-foreground ") +
                    "m-0 rounded-none border-0 bg-transparent text-sm"
                  }
                >
                  {s.step}
                </p>
              </div>
            </li>
          );
        })}
    </ol>
  );
}
