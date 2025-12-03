"use client";
import React from "react";
import { Chip } from "@heroui/react";
import { SparklesIcon } from "@heroicons/react/20/solid";

export default function AIChip({ className }: { className?: string }) {
  return (
    <Chip
      className={`bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 px-2 py-0.5 text-white transition-all duration-200 ease-out hover:brightness-110 ${className || ""}`}
      color="secondary"
      size="sm"
      startContent={<SparklesIcon className="h-3 w-3" />}
      variant="solid"
    >
      AI
    </Chip>
  );
}
