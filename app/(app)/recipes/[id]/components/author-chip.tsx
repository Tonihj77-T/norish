"use client";
import { Avatar } from "@heroui/react";

type Props = {
  name?: string | null;
  image?: string | null;
};
export default function AuthorChip({ name, image }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-black/40 py-1 pr-3 pl-2 shadow-sm backdrop-blur-md">
      <Avatar name={(name || "U")[0].toUpperCase()} size="sm" src={image || undefined} />
      <span className="max-w-[140px] truncate text-sm font-medium text-white/90">
        {name || "Unknown"}
      </span>
    </div>
  );
}
