"use client";

import type { ProviderInfo } from "@/types";

import { Card, CardBody, Divider } from "@heroui/react";
import Image from "next/image";

import { ProviderButton } from "./provider-button";
import { AutoSignIn } from "./auto-sign-in";

import logo from "@/public/norish-logo.png";

interface LoginClientProps {
  providers: ProviderInfo[];
  callbackUrl?: string;
  autoRedirect?: boolean;
}

export function LoginClient({
  providers,
  callbackUrl = "/",
  autoRedirect = false,
}: LoginClientProps) {
  // Auto-redirect for single provider setups
  if (autoRedirect && providers.length === 1) {
    return <AutoSignIn callbackUrl={callbackUrl} provider={providers[0]} />;
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col gap-6 p-8">
          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-foreground flex items-center justify-center gap-2 text-2xl font-semibold">
              <span>Sign in to</span>
              <Image
                priority
                alt="Norish logo"
                className="-mt-[2px] object-contain"
                height={34}
                src={logo}
                width={120}
              />
            </h1>
            <p className="text-small text-default-500">Nourish every moment.</p>
          </div>

          <Divider className="my-2" />

          {/* Provider buttons */}
          {providers.length > 0 ? (
            <div className="flex flex-col gap-3">
              {providers.map((provider) => (
                <ProviderButton
                  key={provider.id}
                  callbackUrl={callbackUrl}
                  icon={provider.icon}
                  providerId={provider.id}
                  providerName={provider.name}
                />
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-small text-danger">No authentication providers configured.</p>
              <p className="text-tiny text-default-500 mt-2">Please contact your administrator.</p>
            </div>
          )}
        </CardBody>
      </Card>

      {providers.length > 0 && (
        <p className="text-small text-default-500 mt-6 text-center">
          You&apos;ll be securely redirected to your sign-in provider.
        </p>
      )}
    </div>
  );
}
