/**
 * Runtime configuration store
 * Stores API keys in memory - not persisted to disk or database
 * Keys can be set via environment variables OR via the settings API
 */

interface RuntimeConfig {
  vapiApiKey: string | null;
  vapiWebhookSecret: string | null;
  vapiPhoneNumberId: string | null;
  anthropicApiKey: string | null;
}

// In-memory store - cleared on server restart
let config: RuntimeConfig = {
  vapiApiKey: null,
  vapiWebhookSecret: null,
  vapiPhoneNumberId: null,
  anthropicApiKey: null,
};

/**
 * Initialize config from environment variables (if present)
 */
export function initializeFromEnv(): void {
  config.vapiApiKey = process.env.VAPI_API_KEY || null;
  config.vapiWebhookSecret = process.env.VAPI_WEBHOOK_SECRET || null;
  config.vapiPhoneNumberId = process.env.VAPI_PHONE_NUMBER_ID || null;
  config.anthropicApiKey = process.env.ANTHROPIC_API_KEY || null;
}

/**
 * Set runtime config (from settings UI)
 */
export function setConfig(newConfig: Partial<RuntimeConfig>): void {
  if (newConfig.vapiApiKey !== undefined) {
    config.vapiApiKey = newConfig.vapiApiKey;
  }
  if (newConfig.vapiWebhookSecret !== undefined) {
    config.vapiWebhookSecret = newConfig.vapiWebhookSecret;
  }
  if (newConfig.vapiPhoneNumberId !== undefined) {
    config.vapiPhoneNumberId = newConfig.vapiPhoneNumberId;
  }
  if (newConfig.anthropicApiKey !== undefined) {
    config.anthropicApiKey = newConfig.anthropicApiKey;
  }
}

/**
 * Get current config
 */
export function getConfig(): Readonly<RuntimeConfig> {
  return { ...config };
}

/**
 * Check if all required keys are configured
 */
export function isConfigured(): boolean {
  return !!(
    config.vapiApiKey &&
    config.vapiPhoneNumberId &&
    config.anthropicApiKey
  );
}

/**
 * Check which keys are missing
 */
export function getMissingKeys(): string[] {
  const missing: string[] = [];
  if (!config.vapiApiKey) missing.push('vapiApiKey');
  if (!config.vapiPhoneNumberId) missing.push('vapiPhoneNumberId');
  if (!config.anthropicApiKey) missing.push('anthropicApiKey');
  // Webhook secret is optional - only needed if validating webhook signatures
  // if (!config.vapiWebhookSecret) missing.push('vapiWebhookSecret');
  return missing;
}

/**
 * Get a specific config value, throwing if not set
 */
export function requireConfig<K extends keyof RuntimeConfig>(key: K): NonNullable<RuntimeConfig[K]> {
  const value = config[key];
  if (!value) {
    throw new Error(`Configuration missing: ${key}. Please configure via Settings.`);
  }
  return value as NonNullable<RuntimeConfig[K]>;
}
