import { setConfig, configExists, getConfig } from "../db/repositories/server-config";
import {
  ServerConfigKeys,
  type ServerConfigKey,
  type AuthProviderGitHub,
  type AuthProviderGoogle,
  type AuthProviderOIDC,
  DEFAULT_RECIPE_PERMISSION_POLICY,
} from "../db/zodSchemas/server-config";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { setAuthProviderCache } from "@/server/auth/provider-cache";
import { serverLogger } from "@/server/logger";
import defaultUnits from "@/config/units.default.json";
import defaultContentIndicators from "@/config/content-indicators.default.json";
import defaultRecurrenceConfig from "@/config/recurrence-config.default.json";

/**
 * Configuration definition for seeding
 * Each key maps to its default value, sensitivity flag, and description
 */
interface ConfigDefinition {
  key: ServerConfigKey;
  getDefaultValue: () => unknown;
  sensitive: boolean;
  description: string;
}

/**
 * All required server config keys with their default values
 * When adding a new config key, add it here and it will be automatically seeded
 */
const REQUIRED_CONFIGS: ConfigDefinition[] = [
  {
    key: ServerConfigKeys.REGISTRATION_ENABLED,
    getDefaultValue: () => true,
    sensitive: false,
    description: "Registration enabled",
  },
  {
    key: ServerConfigKeys.UNITS,
    getDefaultValue: () => defaultUnits,
    sensitive: false,
    description: `Units (${Object.keys(defaultUnits).length} definitions)`,
  },
  {
    key: ServerConfigKeys.CONTENT_INDICATORS,
    getDefaultValue: () => defaultContentIndicators,
    sensitive: false,
    description: "Content indicators",
  },
  {
    key: ServerConfigKeys.RECURRENCE_CONFIG,
    getDefaultValue: () => defaultRecurrenceConfig,
    sensitive: false,
    description: `Recurrence config (${Object.keys(defaultRecurrenceConfig.locales).length} locales)`,
  },
  {
    key: ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS,
    getDefaultValue: () => SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS,
    sensitive: false,
    description: `Scheduler cleanup: ${SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS} months`,
  },
  {
    key: ServerConfigKeys.AI_CONFIG,
    getDefaultValue: () => ({
      enabled: SERVER_CONFIG.AI_ENABLED,
      provider: SERVER_CONFIG.AI_PROVIDER,
      endpoint: SERVER_CONFIG.AI_ENDPOINT || undefined,
      model: SERVER_CONFIG.AI_MODEL,
      apiKey: SERVER_CONFIG.AI_API_KEY || undefined,
      temperature: SERVER_CONFIG.AI_TEMPERATURE,
      maxTokens: SERVER_CONFIG.AI_MAX_TOKENS,
    }),
    sensitive: true, // sensitive due to API key
    description: `AI config (${SERVER_CONFIG.AI_ENABLED ? "enabled" : "disabled"})`,
  },
  {
    key: ServerConfigKeys.VIDEO_CONFIG,
    getDefaultValue: () => ({
      enabled: SERVER_CONFIG.VIDEO_PARSING_ENABLED,
      maxLengthSeconds: SERVER_CONFIG.VIDEO_MAX_LENGTH_SECONDS,
      ytDlpVersion: SERVER_CONFIG.YT_DLP_VERSION,
      transcriptionProvider: SERVER_CONFIG.TRANSCRIPTION_PROVIDER,
      transcriptionEndpoint: SERVER_CONFIG.TRANSCRIPTION_ENDPOINT || undefined,
      transcriptionApiKey: SERVER_CONFIG.TRANSCRIPTION_API_KEY || undefined,
      transcriptionModel: SERVER_CONFIG.TRANSCRIPTION_MODEL,
    }),
    sensitive: true, // sensitive due to transcription API key
    description: `Video config (${SERVER_CONFIG.VIDEO_PARSING_ENABLED ? "enabled" : "disabled"})`,
  },
  {
    key: ServerConfigKeys.RECIPE_PERMISSION_POLICY,
    getDefaultValue: () => DEFAULT_RECIPE_PERMISSION_POLICY,
    sensitive: false,
    description: "Recipe permission policy (default: household)",
  },
];

/**
 * Seed the server_config table with default values
 *
 * This runs after migrations and:
 * 1. Checks each required config key
 * 2. Seeds missing keys with defaults
 * 3. Imports any env-configured auth providers if none exist in DB
 */
export async function seedServerConfig(): Promise<void> {
  serverLogger.info("Checking server configuration...");

  // Always validate and seed missing configs
  const seededCount = await seedMissingConfigs();

  await importEnvAuthProvidersIfMissing();
  if (seededCount === 0) {
    serverLogger.info("All server configuration keys present");
  } else {
    serverLogger.info({ count: seededCount }, "Seeded configuration keys");
  }

  // Load auth providers into cache for BetterAuth initialization
  await loadAuthProvidersIntoCache();

  serverLogger.info("Server configuration check complete");
}

/**
 * Load auth providers from database into the in-memory cache
 * This must run before the auth module is imported so BetterAuth can use DB-configured providers
 */
async function loadAuthProvidersIntoCache(): Promise<void> {
  const github = await getConfig<AuthProviderGitHub>(ServerConfigKeys.AUTH_PROVIDER_GITHUB, true);
  const google = await getConfig<AuthProviderGoogle>(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, true);
  const oidc = await getConfig<AuthProviderOIDC>(ServerConfigKeys.AUTH_PROVIDER_OIDC, true);

  setAuthProviderCache({ github, google, oidc });

  const configured = [github && "GitHub", google && "Google", oidc && `OIDC (${oidc.name})`].filter(
    Boolean
  );

  if (configured.length > 0) {
    serverLogger.info({ providers: configured }, "Auth providers loaded");
  } else {
    serverLogger.warn("No auth providers configured - users will not be able to log in");
  }
}

/**
 * Validate all required configs and seed any missing ones
 * This ensures new config keys added in updates are automatically seeded
 * @returns The number of configs that were seeded
 */
async function seedMissingConfigs(): Promise<number> {
  let seededCount = 0;

  for (const config of REQUIRED_CONFIGS) {
    const exists = await configExists(config.key);

    if (!exists) {
      await setConfig(config.key, config.getDefaultValue(), null, config.sensitive);
      serverLogger.info({ key: config.key, description: config.description }, "Seeded config");
      seededCount++;
    }
  }

  return seededCount;
}

/**
 * Import auth providers configured via environment variables if none exist in DB
 * Only imports providers that are configured in env AND missing from database
 */
async function importEnvAuthProvidersIfMissing(): Promise<void> {
  // Check if any auth providers exist in DB
  const oidcExists = await configExists(ServerConfigKeys.AUTH_PROVIDER_OIDC);
  const githubExists = await configExists(ServerConfigKeys.AUTH_PROVIDER_GITHUB);
  const googleExists = await configExists(ServerConfigKeys.AUTH_PROVIDER_GOOGLE);

  // Import OIDC provider if configured in env and missing from DB
  if (
    !oidcExists &&
    SERVER_CONFIG.OIDC_ISSUER &&
    SERVER_CONFIG.OIDC_CLIENT_ID &&
    SERVER_CONFIG.OIDC_CLIENT_SECRET
  ) {
    await setConfig(
      ServerConfigKeys.AUTH_PROVIDER_OIDC,
      {
        name: SERVER_CONFIG.OIDC_NAME,
        issuer: SERVER_CONFIG.OIDC_ISSUER,
        clientId: SERVER_CONFIG.OIDC_CLIENT_ID,
        clientSecret: SERVER_CONFIG.OIDC_CLIENT_SECRET,
        wellknown: SERVER_CONFIG.OIDC_WELLKNOWN || undefined,
      },
      null,
      true
    );
    serverLogger.info({ name: SERVER_CONFIG.OIDC_NAME }, "Imported OIDC provider from env");
  }

  // Import GitHub provider if configured in env and missing from DB
  if (!githubExists && SERVER_CONFIG.GITHUB_CLIENT_ID && SERVER_CONFIG.GITHUB_CLIENT_SECRET) {
    await setConfig(
      ServerConfigKeys.AUTH_PROVIDER_GITHUB,
      {
        clientId: SERVER_CONFIG.GITHUB_CLIENT_ID,
        clientSecret: SERVER_CONFIG.GITHUB_CLIENT_SECRET,
      },
      null,
      true
    );
    serverLogger.info("Imported GitHub provider from env");
  }

  // Import Google provider if configured in env and missing from DB
  if (!googleExists && SERVER_CONFIG.GOOGLE_CLIENT_ID && SERVER_CONFIG.GOOGLE_CLIENT_SECRET) {
    await setConfig(
      ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
      {
        clientId: SERVER_CONFIG.GOOGLE_CLIENT_ID,
        clientSecret: SERVER_CONFIG.GOOGLE_CLIENT_SECRET,
      },
      null,
      true
    );
    serverLogger.info("Imported Google provider from env");
  }
}

/**
 * Load default values from .default.json files
 * Used for "Restore to defaults" functionality
 */
export function getDefaultConfigValue(key: ServerConfigKey): unknown {
  switch (key) {
    case ServerConfigKeys.REGISTRATION_ENABLED:
      return true;
    case ServerConfigKeys.UNITS:
      return defaultUnits;
    case ServerConfigKeys.CONTENT_INDICATORS:
      return defaultContentIndicators;
    case ServerConfigKeys.RECURRENCE_CONFIG:
      return defaultRecurrenceConfig;
    case ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS:
      return 3;
    case ServerConfigKeys.AI_CONFIG:
      return {
        enabled: false,
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 1.0,
        maxTokens: 10000,
      };
    case ServerConfigKeys.VIDEO_CONFIG:
      return {
        enabled: false,
        maxLengthSeconds: 120,
        ytDlpVersion: "2025.11.12",
        transcriptionProvider: "disabled",
        transcriptionModel: "whisper-1",
      };
    case ServerConfigKeys.RECIPE_PERMISSION_POLICY:
      return DEFAULT_RECIPE_PERMISSION_POLICY;
    default:
      return null;
  }
}
