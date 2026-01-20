import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  setConfig,
  getConfig,
  isConfigured,
  getMissingKeys
} from "../config/runtime-config";

const settings = new Hono();

// Schema for setting config
const setConfigSchema = z.object({
  vapiApiKey: z.string().min(1).optional(),
  vapiWebhookSecret: z.string().optional(),
  vapiPhoneNumberId: z.string().optional(),
  anthropicApiKey: z.string().min(1).optional(),
});

/**
 * GET /api/settings/status
 * Check if the app is configured
 */
settings.get("/status", (c) => {
  const config = getConfig();

  return c.json({
    success: true,
    data: {
      configured: isConfigured(),
      missingKeys: getMissingKeys(),
      // Return which keys are set (but not the values!)
      hasVapiApiKey: !!config.vapiApiKey,
      hasVapiWebhookSecret: !!config.vapiWebhookSecret,
      hasVapiPhoneNumberId: !!config.vapiPhoneNumberId,
      hasAnthropicApiKey: !!config.anthropicApiKey,
    },
  });
});

/**
 * POST /api/settings/config
 * Set API keys at runtime
 */
settings.post("/config", zValidator("json", setConfigSchema), async (c) => {
  const body = c.req.valid("json");

  // Validate Vapi API key if provided
  if (body.vapiApiKey) {
    try {
      const response = await fetch("https://api.vapi.ai/assistant", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${body.vapiApiKey}`,
        },
      });
      if (!response.ok && response.status === 401) {
        return c.json({
          success: false,
          error: "Invalid Vapi API key",
        }, 400);
      }
    } catch (error) {
      // Network error - still allow setting the key
      console.warn("Could not validate Vapi API key:", error);
    }
  }

  // Validate Anthropic API key if provided
  if (body.anthropicApiKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": body.anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (response.status === 401) {
        return c.json({
          success: false,
          error: "Invalid Anthropic API key",
        }, 400);
      }
    } catch (error) {
      // Network error - still allow setting the key
      console.warn("Could not validate Anthropic API key:", error);
    }
  }

  // Set the config - convert undefined to null for type compatibility
  setConfig({
    vapiApiKey: body.vapiApiKey ?? null,
    vapiWebhookSecret: body.vapiWebhookSecret ?? null,
    vapiPhoneNumberId: body.vapiPhoneNumberId ?? null,
    anthropicApiKey: body.anthropicApiKey ?? null,
  });

  return c.json({
    success: true,
    data: {
      configured: isConfigured(),
      message: "Configuration updated successfully",
    },
  });
});

/**
 * DELETE /api/settings/config
 * Clear all runtime config (useful for testing)
 */
settings.delete("/config", (c) => {
  setConfig({
    vapiApiKey: null,
    vapiWebhookSecret: null,
    vapiPhoneNumberId: null,
    anthropicApiKey: null,
  });

  return c.json({
    success: true,
    data: {
      message: "Configuration cleared",
    },
  });
});

export default settings;
