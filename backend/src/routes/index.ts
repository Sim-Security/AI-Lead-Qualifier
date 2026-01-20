import { Hono } from "hono";
import { health } from "./health.ts";
import { leads } from "./leads.ts";
import { webhooks } from "./webhooks.ts";
import settings from "./settings.ts";

/**
 * Main router that combines all API routes under /api prefix
 *
 * Route structure:
 * - /health - Health check endpoint
 * - /api/leads - Lead CRUD operations
 * - /api/webhooks - Webhook handlers for form submissions and Vapi events
 * - /api/settings - Runtime configuration for API keys
 */
const routes = new Hono();

// Health check (no /api prefix - used for infrastructure monitoring)
routes.route("/health", health);

// API routes under /api prefix
const api = new Hono();

// Lead management endpoints
api.route("/leads", leads);

// Webhook endpoints for external integrations
api.route("/webhooks", webhooks);

// Settings endpoints for runtime configuration
api.route("/settings", settings);

// Mount API routes
routes.route("/api", api);

export { routes };
export { health, leads, webhooks, settings };
