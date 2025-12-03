import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { ReactNode } from "react";

import { Slot } from "@/types";

type SlotDropdownProps = {
  children: ReactNode;
  onSelectSlot: (slot: Slot) => void;
  ariaLabel?: string;
};

export function SlotDropdown({
  children,
  onSelectSlot,
  ariaLabel = "Choose slot",
}: SlotDropdownProps) {
  return (
    <Dropdown>
      <DropdownTrigger>{children}</DropdownTrigger>
      <DropdownMenu aria-label={ariaLabel} onAction={(slot) => onSelectSlot(slot as Slot)}>
        <DropdownItem key="Breakfast">Breakfast</DropdownItem>
        <DropdownItem key="Lunch">Lunch</DropdownItem>
        <DropdownItem key="Dinner">Dinner</DropdownItem>
        <DropdownItem key="Snack">Snack</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
