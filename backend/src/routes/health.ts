import { Hono } from "hono";
import { db } from "@/db/index.ts";
import { sql } from "drizzle-orm";
import type { ApiResponse } from "@/types/index.ts";

const health = new Hono();

interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  database: "connected" | "disconnected";
  version: string;
}

health.get("/", async (c) => {
  let dbStatus: "connected" | "disconnected" = "disconnected";

  try {
    await db.execute(sql`SELECT 1`);
    dbStatus = "connected";
  } catch (error) {
    console.error("Database health check failed:", error);
  }

  const healthStatus: HealthStatus = {
    status: dbStatus === "connected" ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    version: "1.0.0",
  };

  const response: ApiResponse<HealthStatus> = {
    success: healthStatus.status === "healthy",
    data: healthStatus,
  };

  return c.json(response, healthStatus.status === "healthy" ? 200 : 503);
});

export { health };
