import type { ProviderInfo } from "@/types";

import { getConfig } from "@/server/db/repositories/server-config";
import {
  ServerConfigKeys,
  type AuthProviderOIDC,
  type AuthProviderGitHub,
  type AuthProviderGoogle,
} from "@/server/db/zodSchemas/server-config";

export async function getAvailableProviders(): Promise<ProviderInfo[]> {
  const providers: ProviderInfo[] = [];

  // Check GitHub provider
  const github = await getConfig<AuthProviderGitHub>(ServerConfigKeys.AUTH_PROVIDER_GITHUB, true);

  if (github?.clientId) {
    providers.push({
      id: "github",
      name: "GitHub",
      icon: "mdi:github",
    });
  }

  // Check Google provider
  const google = await getConfig<AuthProviderGoogle>(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, true);

  if (google?.clientId) {
    providers.push({
      id: "google",
      name: "Google",
      icon: "flat-color-icons:google",
    });
  }

  // Check OIDC provider
  const oidc = await getConfig<AuthProviderOIDC>(ServerConfigKeys.AUTH_PROVIDER_OIDC, true);

  if (oidc?.clientId && oidc?.issuer) {
    providers.push({
      id: "oidc",
      name: oidc.name || "SSO",
      icon: "mdi:shield-account-outline",
    });
  }

  return providers;
}

export async function getConfiguredProviders(): Promise<Record<string, boolean>> {
  const [github, google, oidc] = await Promise.all([
    getConfig<AuthProviderGitHub>(ServerConfigKeys.AUTH_PROVIDER_GITHUB, true),
    getConfig<AuthProviderGoogle>(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, true),
    getConfig<AuthProviderOIDC>(ServerConfigKeys.AUTH_PROVIDER_OIDC, true),
  ]);

  return {
    github: !!github?.clientId,
    google: !!google?.clientId,
    oidc: !!(oidc?.clientId && oidc?.issuer),
  };
}
