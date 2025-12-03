"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { HomeIcon } from "@heroicons/react/16/solid";
import Link from "next/link";
import Image from "next/image";

import notjoundjpg from "@/public/404.jpg";

type Props = {
  title?: string;
  message?: string;
};

export function NotFoundView({
  title = "Page Not Found",
  message = "Oops! Nora couldn't find what you're looking for.\nThe page may have been moved or doesn't exist.",
}: Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card
        className="border-default-200 bg-content1/70 w-full max-w-lg overflow-hidden rounded-3xl border text-center backdrop-blur-md"
        shadow="lg"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image
            fill
            priority
            alt="Nora looking confused"
            className="object-cover"
            src={notjoundjpg}
          />
          <div className="from-content1/90 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
        </div>

        <CardBody className="relative z-10 -mt-12 flex flex-col items-center space-y-4 p-8">
          <div className="flex flex-col items-center space-y-2">
            <h1 className="text-foreground text-4xl font-bold">404</h1>
            <h2 className="text-foreground text-xl font-semibold">{title}</h2>
            <p className="text-default-500 mt-2 text-sm leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          <Button
            as={Link}
            className="mt-4 px-6"
            color="primary"
            href="/"
            radius="lg"
            startContent={<HomeIcon className="h-4 w-4" />}
            variant="solid"
          >
            Go Home
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
