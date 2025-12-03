import { LoginClient } from "./components/login-client";

import { getAvailableProviders } from "@/server/auth/providers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; logout?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const providers = await getAvailableProviders();
  const { callbackUrl = "/", logout } = await searchParams;
  const justLoggedOut = logout === "true";

  const shouldAutoRedirect = providers.length === 1 && !justLoggedOut;

  return (
    <LoginClient
      autoRedirect={shouldAutoRedirect}
      callbackUrl={callbackUrl}
      providers={providers}
    />
  );
}
