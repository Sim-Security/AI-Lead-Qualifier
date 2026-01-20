import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { env } from "@/config/env.ts";
import type { ApiResponse } from "@/types/index.ts";

export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  try {
    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      const response: ApiResponse<null> = {
        success: false,
        error: error.message,
      };
      return c.json(response, error.status);
    }

    if (error instanceof ZodError) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Validation error",
        message: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
      };
      return c.json(response, 400);
    }

    const isDev = env.NODE_ENV === "development";
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("Unhandled error:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: isDev ? errorMessage : "Internal server error",
    };
    if (isDev && error instanceof Error && error.stack) {
      response.message = error.stack;
    }

    return c.json(response, 500);
  }
}
