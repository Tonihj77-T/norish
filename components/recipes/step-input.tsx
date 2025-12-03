"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Textarea, Button } from "@heroui/react";
import { XMarkIcon } from "@heroicons/react/16/solid";

import { MeasurementSystem } from "@/types";

export interface Step {
  step: string;
  order: number;
  systemUsed: MeasurementSystem;
}

export interface StepInputProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  systemUsed?: MeasurementSystem;
}

export default function StepInput({ steps, onChange, systemUsed = "metric" }: StepInputProps) {
  const [inputs, setInputs] = useState<string[]>([""]);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Initialize from steps prop
  useEffect(() => {
    if (steps.length > 0 && inputs.length === 1 && inputs[0] === "") {
      setInputs([...steps.map((s) => s.step), ""]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const handleInputChange = useCallback(
    (index: number, value: string) => {
      const updated = [...inputs];

      updated[index] = value;

      // Auto-add empty line at the end
      if (index === inputs.length - 1 && value.trim()) {
        updated.push("");
      }

      setInputs(updated);

      // Update parent with parsed steps
      const parsed = updated
        .map((text, idx) => ({
          step: text.trim(),
          order: idx,
          systemUsed,
        }))
        .filter((s) => s.step);

      onChange(parsed);
    },
    [inputs, onChange, systemUsed]
  );

  const handleKeyDown = useCallback(
    (index: number, e: any) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Move to next input or create new one
        if (index < inputs.length - 1) {
          textareaRefs.current[index + 1]?.focus();
        } else {
          const updated = [...inputs, ""];

          setInputs(updated);
          setTimeout(() => {
            textareaRefs.current[inputs.length]?.focus();
          }, 0);
        }
      } else if (e.key === "Backspace" && !inputs[index] && index > 0) {
        e.preventDefault();
        const updated = inputs.filter((_, i) => i !== index);

        setInputs(updated);
        const parsed = updated
          .map((text, idx) => ({
            step: text.trim(),
            order: idx,
            systemUsed,
          }))
          .filter((s) => s.step);

        onChange(parsed);
        setTimeout(() => {
          textareaRefs.current[index - 1]?.focus();
        }, 0);
      }
    },
    [inputs, onChange, systemUsed]
  );

  const handleBlur = useCallback(
    (index: number) => {
      // Auto-remove empty rows on blur (except the last one)
      if (!inputs[index].trim() && index < inputs.length - 1) {
        const updated = inputs.filter((_, i) => i !== index);

        if (updated.length === 0) updated.push("");
        setInputs(updated);
        const parsed = updated
          .map((text, idx) => ({
            step: text.trim(),
            order: idx,
            systemUsed,
          }))
          .filter((s) => s.step);

        onChange(parsed);
      }
    },
    [inputs, onChange, systemUsed]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = inputs.filter((_, i) => i !== index);

      if (updated.length === 0) updated.push("");
      setInputs(updated);

      const parsed = updated
        .map((text, idx) => ({
          step: text.trim(),
          order: idx,
          systemUsed,
        }))
        .filter((s) => s.step);

      onChange(parsed);
    },
    [inputs, onChange, systemUsed]
  );

  return (
    <div className="flex flex-col gap-2">
      {inputs.map((value, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="text-default-500 flex h-10 w-8 flex-shrink-0 items-center justify-center font-medium">
            {index + 1}.
          </div>
          <Textarea
            ref={(el) => {
              textareaRefs.current[index] = el;
            }}
            classNames={{
              input: "text-base",
              inputWrapper: "border-default-200 dark:border-default-800",
            }}
            minRows={2}
            placeholder={index === 0 ? "Describe the step..." : ""}
            value={value}
            onBlur={() => handleBlur(index)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onValueChange={(v) => handleInputChange(index, v)}
          />
          <div className="mt-1 h-8 w-8 min-w-8 flex-shrink-0">
            {inputs.length > 1 && value && (
              <Button
                isIconOnly
                className="h-full w-full"
                size="sm"
                variant="light"
                onPress={() => handleRemove(index)}
              >
                <XMarkIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
