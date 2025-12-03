"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { ShoppingCartIcon } from "@heroicons/react/16/solid";

import { MiniGroceries } from "@/components/Panel/consumers";

type Props = {
  recipeId: string;
};

export default function AddToGroceries({ recipeId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        isIconOnly
        aria-label="Add to shopping list"
        className="text-default-500"
        size="sm"
        variant="light"
        onPress={() => setOpen(true)}
      >
        <ShoppingCartIcon className="h-5 w-5" />
      </Button>
      <MiniGroceries open={open} recipeId={recipeId} onOpenChange={setOpen} />
    </>
  );
}
