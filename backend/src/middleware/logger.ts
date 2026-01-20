import type { Context, Next } from "hono";
import { env } from "@/config/env.ts";

type LogLevel = "debug" | "info" | "warn" | "error";

const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return logLevels[level] >= logLevels[env.LOG_LEVEL];
}

function formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  console[level](formatLog(level, message, meta));
}

export async function requestLogger(c: Context, next: Next): Promise<void> {
  const requestId = crypto.randomUUID();
  const start = performance.now();

  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  const method = c.req.method;
  const path = c.req.path;
  const userAgent = c.req.header("user-agent") ?? "unknown";

  log("info", `--> ${method} ${path}`, {
    requestId,
    userAgent,
  });

  await next();

  const duration = (performance.now() - start).toFixed(2);
  const status = c.res.status;

  const level: LogLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  log(level, `<-- ${method} ${path} ${status} ${duration}ms`, {
    requestId,
    status,
    duration: `${duration}ms`,
  });
}
