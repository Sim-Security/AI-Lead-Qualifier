import { Hono } from "hono";
import { z } from "zod";
import { db, schema } from "@/db/index.ts";
import { eq, isNull, desc, asc, and, count, or, ilike } from "drizzle-orm";
import { env } from "@/config/env.ts";
import { log } from "@/middleware/logger.ts";
import type { ApiResponse, PaginatedResponse } from "@/types/index.ts";
import type { Lead } from "@/db/schema.ts";

const leads = new Hono();

// =============================================================================
// Zod Validation Schemas
// =============================================================================

const uuidSchema = z.string().uuid("Invalid UUID format");

const createLeadSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().min(1, "Phone number is required").max(50),
  company: z.string().min(1, "Company name is required").max(255),
  role: z.string().max(100).optional(),
  companySize: z
    .enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"])
    .optional(),
  initialRequest: z.string().min(1, "Initial request is required"),
});

const updateLeadSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().min(1).max(50).optional(),
  company: z.string().min(1).max(255).optional(),
  role: z.string().max(100).optional().nullable(),
  companySize: z
    .enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"])
    .optional()
    .nullable(),
  initialRequest: z.string().min(1).optional(),
  callStatus: z
    .enum(["pending", "calling", "completed", "failed", "no_answer"])
    .optional(),
  motivation: z.string().optional().nullable(),
  timeline: z.string().max(100).optional().nullable(),
  budget: z.string().max(100).optional().nullable(),
  authority: z.string().max(100).optional().nullable(),
  pastExperience: z.string().optional().nullable(),
  intent: z.enum(["hot", "warm", "cold"]).optional().nullable(),
  qualificationScore: z.number().min(0).max(100).optional().nullable(),
  transcript: z.string().optional().nullable(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(["pending", "calling", "completed", "failed", "no_answer"])
    .optional(),
  intent: z.enum(["hot", "warm", "cold"]).optional(),
  search: z.string().max(255).optional(),
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "firstName",
      "lastName",
      "company",
      "qualificationScore",
      "callStatus",
      "intent",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Initiates a Vapi call for a lead
 */
async function initiateVapiCall(lead: Lead): Promise<{ callId: string } | null> {
  try {
    const response = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: process.env.VAPI_ASSISTANT_ID,
        customer: {
          number: lead.phone,
          name: `${lead.firstName} ${lead.lastName}`,
        },
        metadata: {
          leadId: lead.id,
        },
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("error", "Failed to initiate Vapi call", {
        leadId: lead.id,
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = (await response.json()) as { id: string };
    log("info", "Vapi call initiated", {
      leadId: lead.id,
      callId: data.id,
    });

    return { callId: data.id };
  } catch (error) {
    log("error", "Error initiating Vapi call", {
      leadId: lead.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * GET /api/leads - List leads with pagination, filtering, and sorting
 */
leads.get("/", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const parseResult = paginationSchema.safeParse(query);

  if (!parseResult.success) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Validation error",
      message: parseResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", "),
    };
    return c.json(response, 400);
  }

  const params = parseResult.data;

  // Build WHERE conditions
  const whereConditions = [isNull(schema.leads.deletedAt)];

  if (params.status) {
    whereConditions.push(eq(schema.leads.callStatus, params.status));
  }

  if (params.intent) {
    whereConditions.push(eq(schema.leads.intent, params.intent));
  }

  if (params.search) {
    const searchPattern = `%${params.search}%`;
    whereConditions.push(
      or(
        ilike(schema.leads.firstName, searchPattern),
        ilike(schema.leads.lastName, searchPattern),
        ilike(schema.leads.email, searchPattern),
        ilike(schema.leads.company, searchPattern)
      )!
    );
  }

  // Build ORDER BY clause
  const sortColumn = {
    createdAt: schema.leads.createdAt,
    updatedAt: schema.leads.updatedAt,
    firstName: schema.leads.firstName,
    lastName: schema.leads.lastName,
    company: schema.leads.company,
    qualificationScore: schema.leads.qualificationScore,
    callStatus: schema.leads.callStatus,
    intent: schema.leads.intent,
  }[params.sortBy];

  const orderFn = params.sortOrder === "asc" ? asc : desc;
  const offset = (params.page - 1) * params.limit;

  // Execute queries in parallel
  const [leadsList, totalResult] = await Promise.all([
    db
      .select()
      .from(schema.leads)
      .where(and(...whereConditions))
      .orderBy(orderFn(sortColumn))
      .limit(params.limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(schema.leads)
      .where(and(...whereConditions)),
  ]);

  const total = totalResult[0]?.count ?? 0;

  const response: PaginatedResponse<Lead> = {
    success: true,
    data: leadsList,
    pagination: {
      page: params.page,
      pageSize: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };

  return c.json(response);
});

/**
 * GET /api/leads/:id - Get a single lead by ID
 */
leads.get("/:id", async (c) => {
  const id = c.req.param("id");
  const parseResult = uuidSchema.safeParse(id);

  if (!parseResult.success) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Invalid lead ID format",
    };
    return c.json(response, 400);
  }

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)));

  if (!lead) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Lead not found",
    };
    return c.json(response, 404);
  }

  const response: ApiResponse<Lead> = {
    success: true,
    data: lead,
  };

  return c.json(response);
});

/**
 * POST /api/leads - Create a new lead
 */
leads.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    const response: ApiResponse<null> = {
      success: false,
      error: "Invalid JSON body",
    };
    return c.json(response, 400);
  }

  const parseResult = createLeadSchema.safeParse(body);

  if (!parseResult.success) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Validation error",
      message: parseResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", "),
    };
    return c.json(response, 400);
  }

  const input = parseResult.data;

  const [lead] = await db
    .insert(schema.leads)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      company: input.company,
      role: input.role,
      companySize: input.companySize,
      initialRequest: input.initialRequest,
      callStatus: "pending",
    })
    .returning();

  if (!lead) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to create lead",
    };
    return c.json(response, 500);
  }

  log("info", "Lead created via API", {
    leadId: lead.id,
    email: lead.email,
  });

  const response: ApiResponse<Lead> = {
    success: true,
    data: lead,
    message: "Lead created successfully",
  };

  return c.json(response, 201);
});

/**
 * PATCH /api/leads/:id - Update a lead
 */
leads.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const idParseResult = uuidSchema.safeParse(id);

  if (!idParseResult.success) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Invalid lead ID format",
    };
    return c.json(response, 400);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    const response: ApiResponse<null> = {
      success: false,
      error: "Invalid JSON body",
    };
    return c.json(response, 400);
  }

  const parseResult = updateLeadSchema.safeParse(body);

  if (!parseResult.success) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Validation error",
      message: parseResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", "),
    };
    return c.json(response, 400);
  }

  const input = parseResult.data;

  // Check if lead exists
  const [existingLead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)));

  if (!existingLead) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Lead not found",
    };
    return c.json(response, 404);
  }

  // Build update object explicitly
  const updateData: Partial<typeof schema.leads.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.firstName !== undefined) updateData.firstName = input.firstName;
  if (input.lastName !== undefined) updateData.lastName = input.lastName;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.company !== undefined) updateData.company = input.company;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.companySize !== undefined) updateData.companySize = input.companySize;
  if (input.initialRequest !== undefined) updateData.initialRequest = input.initialRequest;
  if (input.callStatus !== undefined) updateData.callStatus = input.callStatus;
  if (input.motivation !== undefined) updateData.motivation = input.motivation;
  if (input.timeline !== undefined) updateData.timeline = input.timeline;
  if (input.budget !== undefined) updateData.budget = input.budget;
  if (input.authority !== undefined) updateData.authority = input.authority;
  if (input.pastExperience !== undefined) updateData.pastExperience = input.pastExperience;
  if (input.intent !== undefined) updateData.intent = input.intent;
  if (input.qualificationScore !== undefined)
    updateData.qualificationScore = input.qualificationScore;
  if (input.transcript !== undefined) updateData.transcript = input.transcript;

  // Perform update
  const [updatedLead] = await db
    .update(schema.leads)
    .set(updateData)
    .where(eq(schema.leads.id, id))
    .returning();

  if (!updatedLead) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to update lead",
    };
    return c.json(response, 500);
  }

  log("info", "Lead updated", {
    leadId: id,
    fields: Object.keys(input),
  });

  const response: ApiResponse<Lead> = {
    success: true,
    data: updatedLead,
    message: "Lead updated successfully",
  };

  return c.json(response);
});

/**
 * DELETE /api/leads/:id - Soft delete a lead
 */
leads.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const parseResult = uuidSchema.safeParse(id);

  if (!parseResult.success) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Invalid lead ID format",
    };
    return c.json(response, 400);
  }

  // Check if lead exists
  const [existingLead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)));

  if (!existingLead) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Lead not found",
    };
    return c.json(response, 404);
  }

  // Soft delete
  await db
    .update(schema.leads)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.leads.id, id));

  log("info", "Lead soft deleted", { leadId: id });

  const response: ApiResponse<null> = {
    success: true,
    message: "Lead deleted successfully",
  };

  return c.json(response);
});

/**
 * GET /api/leads/:id/transcript - Get call transcript for a lead
 */
leads.get("/:id/transcript", async (c) => {
  const id = c.req.param("id");
  const parseResult = uuidSchema.safeParse(id);

  if (!parseResult.success) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Invalid lead ID format",
    };
    return c.json(response, 400);
  }

  const [lead] = await db
    .select({
      id: schema.leads.id,
      transcript: schema.leads.transcript,
      callStatus: schema.leads.callStatus,
      callDuration: schema.leads.callDuration,
      callStartedAt: schema.leads.callStartedAt,
      callEndedAt: schema.leads.callEndedAt,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)));

  if (!lead) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Lead not found",
    };
    return c.json(response, 404);
  }

  const response: ApiResponse<{
    transcript: string | null;
    callStatus: string;
    callDuration: number | null;
    callStartedAt: Date | null;
    callEndedAt: Date | null;
  }> = {
    success: true,
    data: {
      transcript: lead.transcript,
      callStatus: lead.callStatus,
      callDuration: lead.callDuration,
      callStartedAt: lead.callStartedAt,
      callEndedAt: lead.callEndedAt,
    },
  };

  return c.json(response);
});

/**
 * POST /api/leads/:id/retry-call - Retry a failed call for a lead
 */
leads.post("/:id/retry-call", async (c) => {
  const id = c.req.param("id");
  const parseResult = uuidSchema.safeParse(id);

  if (!parseResult.success) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Invalid lead ID format",
    };
    return c.json(response, 400);
  }

  // Find the lead
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)));

  if (!lead) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Lead not found",
    };
    return c.json(response, 404);
  }

  // Check if call can be retried
  const retriableStatuses = ["failed", "no_answer", "pending"];
  if (!retriableStatuses.includes(lead.callStatus)) {
    const response: ApiResponse<null> = {
      success: false,
      error: `Cannot retry call for lead with status '${lead.callStatus}'. Call can only be retried for 'failed', 'no_answer', or 'pending' status.`,
    };
    return c.json(response, 400);
  }

  // Initiate new call
  const callResult = await initiateVapiCall(lead);

  if (!callResult) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to initiate call. Please try again later.",
    };
    return c.json(response, 500);
  }

  // Update lead with new call information
  await db
    .update(schema.leads)
    .set({
      callId: callResult.callId,
      callStatus: "calling",
      callStartedAt: null,
      callEndedAt: null,
      callDuration: null,
      transcript: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.leads.id, id));

  log("info", "Call retry initiated", {
    leadId: id,
    callId: callResult.callId,
  });

  const response: ApiResponse<{ callId: string }> = {
    success: true,
    data: { callId: callResult.callId },
    message: "Call retry initiated successfully",
  };

  return c.json(response);
});

export { leads };
