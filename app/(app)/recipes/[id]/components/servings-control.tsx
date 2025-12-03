"use client";

import React, { useEffect, useCallback } from "react";
import { Button } from "@heroui/react";
import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";

import { useRecipeContextRequired } from "../context";

export default function ServingsControl() {
  const { recipe, setIngredientAmounts } = useRecipeContextRequired();
  const [servings, setServings] = React.useState<number>(Math.max(1, recipe.servings ?? 1));

  const adjust = useCallback(
    (servingsValue: number) => {
      setIngredientAmounts(servingsValue);
    },
    [setIngredientAmounts]
  );

  useEffect(() => {
    if (recipe.recipeIngredients == null || recipe.recipeIngredients.length === 0) return;

    adjust(servings);
  }, [servings, adjust, recipe.recipeIngredients]);

  const dec = () => setServings((s) => Math.max(1, s - 1));
  const inc = () => setServings((s) => s + 1);

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        isIconOnly
        aria-label="Decrease servings"
        className="bg-content2"
        size="sm"
        variant="flat"
        onPress={dec}
      >
        <MinusIcon className="h-4 w-4" />
      </Button>
      <span className="min-w-8 text-center text-sm">{servings}</span>
      <Button
        isIconOnly
        aria-label="Increase servings"
        className="bg-content2"
        size="sm"
        variant="flat"
        onPress={inc}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
