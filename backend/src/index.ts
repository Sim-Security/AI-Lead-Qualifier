import { Hono } from "hono";
import { env } from "@/config/env.ts";
import { corsMiddleware } from "@/middleware/cors.ts";
import { errorHandler } from "@/middleware/error-handler.ts";
import { requestLogger, log } from "@/middleware/logger.ts";
import { routes } from "@/routes/index.ts";

/**
 * AI Lead Qualifier Backend Server
 *
 * This is the main entry point for the backend API server.
 * It sets up middleware, routes, and starts the HTTP server.
 *
 * Available endpoints:
 * - GET /health - Health check
 * - GET /api/leads - List leads (with pagination, filtering, sorting)
 * - GET /api/leads/:id - Get single lead
 * - POST /api/leads - Create lead
 * - PATCH /api/leads/:id - Update lead
 * - DELETE /api/leads/:id - Soft delete lead
 * - GET /api/leads/:id/transcript - Get call transcript
 * - POST /api/leads/:id/retry-call - Retry failed call
 * - POST /api/webhooks/form - Receive form submissions
 * - POST /api/webhooks/vapi - Receive Vapi call events
 */

const app = new Hono();

// =============================================================================
// Global Middleware
// =============================================================================

// CORS handling for cross-origin requests
app.use("*", corsMiddleware);

// Error handling middleware (catches and formats all errors)
app.use("*", errorHandler);

// Request logging middleware
app.use("*", requestLogger);

// =============================================================================
// Routes
// =============================================================================

// Mount all routes
app.route("/", routes);

// =============================================================================
// 404 Handler
// =============================================================================

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Not found",
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// =============================================================================
// Server Startup (Bun native)
// =============================================================================

log("info", `Starting AI Lead Qualifier API server`, {
  port: env.PORT,
  environment: env.NODE_ENV,
  corsOrigin: env.CORS_ORIGIN,
});

console.log(`Server running on http://localhost:${env.PORT}`);

// Export for Bun.serve() to automatically start the server
export default {
  port: env.PORT,
  fetch: app.fetch,
};

// Also export app for testing
export { app };
