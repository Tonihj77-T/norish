"use client";

import { ClockIcon, UserGroupIcon, EllipsisHorizontalIcon } from "@heroicons/react/16/solid";
import { Chip, Button } from "@heroui/react";

import { cssGlassBackdropChip } from "@/config/css-tokens";

interface RecipeMetadataProps {
  timeLabel?: string | null;
  servings?: number | null;
  onOptionsPress?: () => void;
}

export default function RecipeMetadata({
  timeLabel,
  servings,
  onOptionsPress,
}: RecipeMetadataProps) {
  return (
    <div className="pointer-events-auto absolute top-2 right-2 z-20 flex items-center gap-2">
      {timeLabel && (
        <Chip
          className={`px-2 text-[11px] text-white ${cssGlassBackdropChip}`}
          radius="full"
          size="sm"
          startContent={<ClockIcon className="h-4 w-4" />}
          variant="flat"
        >
          {timeLabel}
        </Chip>
      )}

      {typeof servings === "number" && servings > 0 && (
        <Chip
          className={`px-2 text-[11px] text-white ${cssGlassBackdropChip}`}
          radius="full"
          size="sm"
          startContent={<UserGroupIcon className="h-4 w-4" />}
          variant="flat"
        >
          {servings}
        </Chip>
      )}

      <Button
        isIconOnly
        className={`text-white ${cssGlassBackdropChip} h-6 w-6 min-w-0 p-0`}
        radius="full"
        size="sm"
        variant="flat"
        onPress={onOptionsPress}
      >
        <EllipsisHorizontalIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
