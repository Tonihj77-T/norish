"use client";

import React from "react";
import { Button, ButtonGroup } from "@heroui/react";

import { MeasurementSystem } from "@/types";

export interface MeasurementSystemSelectorProps {
  value: MeasurementSystem;
  onChange: (system: MeasurementSystem) => void;
  detected?: MeasurementSystem;
  className?: string;
}

const systemLabels: Record<MeasurementSystem, string> = {
  metric: "Metric",
  us: "US",
};

export default function MeasurementSystemSelector({
  value,
  onChange,
  detected,
  className = "",
}: MeasurementSystemSelectorProps) {
  const systems: MeasurementSystem[] = ["metric", "us"];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-default-700 text-sm font-medium">Measurement System</span>
        {detected && detected !== value && (
          <span className="text-default-500 text-xs">Detected: {systemLabels[detected]}</span>
        )}
      </div>
      <ButtonGroup className="w-full" size="md">
        {systems.map((system) => (
          <Button
            key={system}
            className="flex-1"
            color={value === system ? "primary" : "default"}
            variant={value === system ? "solid" : "flat"}
            onPress={() => onChange(system)}
          >
            {systemLabels[system]}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
}
