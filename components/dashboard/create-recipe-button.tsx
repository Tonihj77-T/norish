"use client";

import React from "react";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/16/solid";

export default function CreateRecipeButton() {
  const router = useRouter();

  return (
    <>
      {/* Desktop */}
      <Button
        className="hidden font-medium md:flex"
        color="primary"
        radius="full"
        size="md"
        startContent={<PlusIcon className="h-4 w-4" />}
        onPress={() => router.push("/recipes/new")}
      >
        Create Recipe
      </Button>

      {/* Mobile - Icon only */}
      <Button
        isIconOnly
        className="md:hidden"
        color="primary"
        radius="full"
        size="md"
        onPress={() => router.push("/recipes/new")}
      >
        <PlusIcon className="h-5 w-5" />
      </Button>
    </>
  );
}
