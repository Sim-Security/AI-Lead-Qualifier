import { Hono } from "hono";
import { z } from "zod";
import { db, schema } from "@/db/index.ts";
import { eq, and, isNull } from "drizzle-orm";
import { env } from "@/config/env.ts";
import { log } from "@/middleware/logger.ts";
import { extractQualificationData, type CallContext } from "@/services/index.ts";
import type { ApiResponse } from "@/types/index.ts";
import type { Lead } from "@/db/schema.ts";

const webhooks = new Hono();

// =============================================================================
// Zod Validation Schemas
// =============================================================================

// Form submission schema
const formSubmissionSchema = z.object({
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

// Vapi call-started event payload
const vapiCallStartedSchema = z.object({
  type: z.literal("call-started"),
  call: z.object({
    id: z.string(),
    orgId: z.string().optional(),
    assistantId: z.string().optional(),
    phoneNumber: z.string().optional(),
    customer: z
      .object({
        number: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    metadata: z
      .object({
        leadId: z.string().uuid(),
      })
      .optional(),
    createdAt: z.string().optional(),
    startedAt: z.string().optional(),
  }),
  timestamp: z.string().optional(),
});

// Vapi call-ended event payload
const vapiCallEndedSchema = z.object({
  type: z.literal("call-ended"),
  call: z.object({
    id: z.string(),
    orgId: z.string().optional(),
    assistantId: z.string().optional(),
    phoneNumber: z.string().optional(),
    customer: z
      .object({
        number: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    metadata: z
      .object({
        leadId: z.string().uuid(),
      })
      .optional(),
    createdAt: z.string().optional(),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
    endedReason: z
      .enum([
        "assistant-ended-call",
        "customer-ended-call",
        "voicemail-reached",
        "silence-timed-out",
        "phone-call-provider-closed-websocket",
        "pipeline-error-exceeded-max-retries",
        "unknown",
      ])
      .optional(),
    cost: z.number().optional(),
    costBreakdown: z.record(z.number()).optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(["assistant", "user", "system", "function_call", "function_result"]),
          content: z.string().optional(),
          message: z.string().optional(),
          time: z.number().optional(),
          secondsFromStart: z.number().optional(),
        })
      )
      .optional(),
    transcript: z.string().optional(),
    recordingUrl: z.string().url().optional(),
    summary: z.string().optional(),
    analysis: z
      .object({
        summary: z.string().optional(),
        structuredData: z.record(z.unknown()).optional(),
        successEvaluation: z.string().optional(),
      })
      .optional(),
  }),
  timestamp: z.string().optional(),
});

// Vapi call-failed event payload
const vapiCallFailedSchema = z.object({
  type: z.literal("call-failed"),
  call: z.object({
    id: z.string(),
    orgId: z.string().optional(),
    assistantId: z.string().optional(),
    phoneNumber: z.string().optional(),
    customer: z
      .object({
        number: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    metadata: z
      .object({
        leadId: z.string().uuid(),
      })
      .optional(),
    createdAt: z.string().optional(),
    failedAt: z.string().optional(),
    error: z
      .object({
        message: z.string().optional(),
        code: z.string().optional(),
      })
      .optional(),
  }),
  timestamp: z.string().optional(),
});

// Combined Vapi webhook schema (discriminated union)
const vapiWebhookSchema = z.discriminatedUnion("type", [
  vapiCallStartedSchema,
  vapiCallEndedSchema,
  vapiCallFailedSchema,
  // Generic handler for other events we acknowledge but don't process
  z.object({
    type: z.literal("transcript-update"),
    call: z.object({ id: z.string(), metadata: z.object({ leadId: z.string().uuid() }).optional() }).passthrough(),
  }),
  z.object({
    type: z.literal("function-call"),
    call: z.object({ id: z.string(), metadata: z.object({ leadId: z.string().uuid() }).optional() }).passthrough(),
  }),
  z.object({
    type: z.literal("hang"),
    call: z.object({ id: z.string(), metadata: z.object({ leadId: z.string().uuid() }).optional() }).passthrough(),
  }),
  z.object({
    type: z.literal("speech-update"),
    call: z.object({ id: z.string(), metadata: z.object({ leadId: z.string().uuid() }).optional() }).passthrough(),
  }),
  z.object({
    type: z.literal("status-update"),
    call: z.object({ id: z.string(), metadata: z.object({ leadId: z.string().uuid() }).optional() }).passthrough(),
  }),
]);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generates the BANT qualification system prompt for a lead
 */
function getQualificationPrompt(lead: Lead): string {
  return `You are an AI assistant working for Adam Simonar at Ranomis AI. You are conducting a brief qualification call.
Your goal is to gather a little more information about the lead's inquiry using the BANT framework while being conversational and friendly.

IMPORTANT IDENTITY:
- You are an AI agent (be transparent about this if asked)
- You work for Adam Simonar of Ranomis AI
- You are calling to learn more about their recent message/inquiry
- Adam or someone from the Ranomis AI team will follow up personally after this call

LEAD CONTEXT:
- Name: ${lead.firstName} ${lead.lastName}
- Company: ${lead.company}
- Role: ${lead.role || "Not specified"}
- Their Message: ${lead.initialRequest}

QUALIFICATION OBJECTIVES (BANT Framework):

1. BUDGET: Understand their budget range and financial readiness
   - Ask about their allocated budget for this type of solution
   - Determine if budget is approved or pending approval

2. AUTHORITY: Identify decision-making power
   - Confirm if they are the decision maker
   - Ask who else is involved in the decision process

3. NEED: Clarify their specific requirements
   - Understand their current pain points
   - Ask about their motivation for seeking this solution
   - Inquire about past experience with similar solutions

4. TIMELINE: Determine urgency and implementation timeframe
   - Ask when they need to have a solution in place
   - Understand any deadlines or time constraints

CONVERSATION GUIDELINES:
- Be professional but warm and conversational
- Ask open-ended questions to encourage detailed responses
- Listen actively and acknowledge their responses
- Keep the call focused but not rushed
- If they seem busy, offer to reschedule
- Thank them for their time at the end

IMPORTANT:
- Do not be pushy or aggressive
- Respect their time - aim for a 3-5 minute call
- If they're not interested, thank them politely and end the call
- Gather as much qualification data as possible naturally

End the call by thanking them and letting them know Adam or someone from the Ranomis AI team will follow up personally with more information based on their needs.`;
}

/**
 * Initiates a Vapi call for a lead using transient assistant
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
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: lead.phone,
          name: `${lead.firstName} ${lead.lastName}`,
        },
        metadata: {
          leadId: lead.id,
        },
        assistant: {
          name: "Ranomis AI Assistant",
          firstMessage: `Hello, is this ${lead.firstName}? Hi ${lead.firstName}, this is an AI assistant calling on behalf of Adam Simonar at Ranomis AI. I'm reaching out about your recent message regarding ${lead.initialRequest}. Do you have a few minutes so I can learn a bit more about what you're looking for?`,
          model: {
            provider: "openai",
            model: "gpt-4",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content: getQualificationPrompt(lead),
              },
            ],
          },
          voice: {
            provider: "11labs",
            voiceId: "21m00Tcm4TlvDq8ikWAM",
          },
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en",
          },
          endCallMessage: "Thank you so much for your time today. Adam or someone from the Ranomis AI team will follow up with you personally based on what we discussed. Have a great day!",
          silenceTimeoutSeconds: 30,
          maxDurationSeconds: 300,
        },
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


/**
 * Calculate call duration in seconds from timestamps
 */
function calculateCallDuration(startedAt?: string, endedAt?: string): number | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  return Math.round((end - start) / 1000);
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * POST /api/webhooks/form - Receive lead form submissions
 *
 * This endpoint receives form submissions from the frontend,
 * creates a new lead in the database, and initiates a Vapi call.
 */
webhooks.post("/form", async (c) => {
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

  const parseResult = formSubmissionSchema.safeParse(body);

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

  log("info", "Received form submission", {
    email: input.email,
    company: input.company,
  });

  // Create lead in database
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

  log("info", "Lead created", {
    leadId: lead.id,
    email: lead.email,
  });

  // Initiate Vapi call asynchronously
  const callResult = await initiateVapiCall(lead);

  if (callResult) {
    // Update lead with call ID and status
    await db
      .update(schema.leads)
      .set({
        callId: callResult.callId,
        callStatus: "calling",
        updatedAt: new Date(),
      })
      .where(eq(schema.leads.id, lead.id));

    log("info", "Lead updated with call ID", {
      leadId: lead.id,
      callId: callResult.callId,
    });
  }

  const response: ApiResponse<{ leadId: string; callInitiated: boolean }> = {
    success: true,
    data: {
      leadId: lead.id,
      callInitiated: callResult !== null,
    },
    message: callResult
      ? "Lead created and call initiated successfully"
      : "Lead created successfully, call initiation pending",
  };

  return c.json(response, 201);
});

/**
 * POST /api/webhooks/vapi - Receive Vapi call events
 *
 * This endpoint handles webhook events from Vapi including:
 * - call-started: Update lead status to 'calling'
 * - call-ended: Extract qualification data and update lead
 * - call-failed: Update lead status to 'failed'
 */
webhooks.post("/vapi", async (c) => {
  const body = await c.req.json();

  log("info", "Received Vapi webhook", {
    type: body.type,
    callId: body.call?.id,
  });

  // Validate the webhook payload
  const parseResult = vapiWebhookSchema.safeParse(body);

  if (!parseResult.success) {
    log("warn", "Invalid Vapi webhook payload", {
      errors: parseResult.error.errors,
    });
    // Return 200 to acknowledge receipt even if we can't process it
    // This prevents Vapi from retrying
    return c.json({ success: true, message: "Acknowledged but not processed" });
  }

  const event = parseResult.data;
  const leadId = event.call.metadata?.leadId;

  if (!leadId) {
    log("warn", "Vapi webhook missing leadId in metadata", {
      callId: event.call.id,
    });
    return c.json({ success: true, message: "No leadId in metadata" });
  }

  // Find the lead
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt)));

  if (!lead) {
    log("warn", "Lead not found for Vapi webhook", {
      leadId,
      callId: event.call.id,
    });
    return c.json({ success: true, message: "Lead not found" });
  }

  // Handle different event types
  switch (event.type) {
    case "call-started": {
      log("info", "Call started", {
        leadId,
        callId: event.call.id,
      });

      await db
        .update(schema.leads)
        .set({
          callId: event.call.id,
          callStatus: "calling",
          callStartedAt: event.call.startedAt ? new Date(event.call.startedAt) : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.leads.id, leadId));

      break;
    }

    case "call-ended": {
      const callData = event.call;
      const duration = calculateCallDuration(callData.startedAt, callData.endedAt);

      log("info", "Call ended", {
        leadId,
        callId: callData.id,
        duration,
        endedReason: callData.endedReason,
      });

      // Determine call status based on ended reason
      let callStatus: "completed" | "failed" | "no_answer" = "completed";
      if (callData.endedReason === "voicemail-reached") {
        callStatus = "no_answer";
      } else if (
        callData.endedReason === "pipeline-error-exceeded-max-retries" ||
        callData.endedReason === "phone-call-provider-closed-websocket"
      ) {
        callStatus = "failed";
      }

      // Build transcript from messages if not provided directly
      let transcript = callData.transcript;
      if (!transcript && callData.messages) {
        transcript = callData.messages
          .filter((m) => m.role === "assistant" || m.role === "user")
          .map((m) => `${m.role === "assistant" ? "Agent" : "Lead"}: ${m.content || m.message || ""}`)
          .join("\n");
      }

      // Extract qualification data using AI-powered analysis
      // Includes call context (duration, end reason) for accurate scoring
      const callContext: CallContext = {
        transcript: transcript || null,
        duration: duration,
        endedReason: callData.endedReason || null,
      };

      const qualificationData = await extractQualificationData(callContext);

      log("info", "Qualification analysis complete", {
        leadId,
        intent: qualificationData.intent,
        score: qualificationData.qualificationScore,
        endedReason: callData.endedReason,
        duration,
      });

      await db
        .update(schema.leads)
        .set({
          callStatus,
          callEndedAt: callData.endedAt ? new Date(callData.endedAt) : new Date(),
          callDuration: duration,
          transcript: transcript || undefined,
          motivation: qualificationData.motivation,
          timeline: qualificationData.timeline,
          budget: qualificationData.budget,
          authority: qualificationData.authority,
          pastExperience: qualificationData.pastExperience,
          intent: qualificationData.intent,
          qualificationScore: qualificationData.qualificationScore,
          updatedAt: new Date(),
        })
        .where(eq(schema.leads.id, leadId));

      break;
    }

    case "call-failed": {
      const callData = event.call;

      log("error", "Call failed", {
        leadId,
        callId: callData.id,
        error: callData.error,
      });

      await db
        .update(schema.leads)
        .set({
          callStatus: "failed",
          updatedAt: new Date(),
        })
        .where(eq(schema.leads.id, leadId));

      break;
    }

    default: {
      // Acknowledge other event types without processing
      log("debug", "Received unhandled Vapi event type", {
        type: event.type,
        leadId,
      });
    }
  }

  const response: ApiResponse<{ processed: boolean }> = {
    success: true,
    data: { processed: true },
  };

  return c.json(response);
});

/**
 * POST /api/webhooks/sync/:leadId - Manually sync call data from Vapi
 *
 * This endpoint fetches call data directly from Vapi API and updates
 * the lead record. Useful when webhooks can't reach localhost.
 */
webhooks.post("/sync/:leadId", async (c) => {
  const leadId = c.req.param("leadId");

  // Find the lead
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt)));

  if (!lead) {
    return c.json({ success: false, error: "Lead not found" }, 404);
  }

  if (!lead.callId) {
    return c.json({ success: false, error: "No call ID associated with this lead" }, 400);
  }

  // Fetch call data from Vapi
  try {
    const response = await fetch(`https://api.vapi.ai/call/${lead.callId}`, {
      headers: {
        Authorization: `Bearer ${env.VAPI_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log("error", "Failed to fetch call from Vapi", {
        leadId,
        callId: lead.callId,
        status: response.status,
        error: errorText,
      });
      return c.json({ success: false, error: "Failed to fetch call data from Vapi" }, 500);
    }

    const callData = await response.json() as {
      id: string;
      status: string;
      startedAt?: string;
      endedAt?: string;
      endedReason?: string;
      transcript?: string;
      messages?: Array<{ role: string; content?: string; message?: string }>;
      analysis?: { structuredData?: Record<string, unknown> };
    };

    log("info", "Fetched call data from Vapi", {
      leadId,
      callId: callData.id,
      status: callData.status,
    });

    // Only update if call has ended
    if (callData.status !== "ended") {
      return c.json({
        success: true,
        data: { synced: false, reason: "Call still in progress", callStatus: callData.status },
      });
    }

    const duration = calculateCallDuration(callData.startedAt, callData.endedAt);

    // Determine call status based on ended reason
    let callStatus: "completed" | "failed" | "no_answer" = "completed";
    if (callData.endedReason === "voicemail-reached") {
      callStatus = "no_answer";
    } else if (
      callData.endedReason === "pipeline-error-exceeded-max-retries" ||
      callData.endedReason === "phone-call-provider-closed-websocket"
    ) {
      callStatus = "failed";
    }

    // Use transcript directly or build from messages
    let transcript = callData.transcript;
    if (!transcript && callData.messages) {
      transcript = callData.messages
        .filter((m) => m.role === "assistant" || m.role === "user")
        .map((m) => `${m.role === "assistant" ? "Agent" : "Lead"}: ${m.content || m.message || ""}`)
        .join("\n");
    }

    // Extract qualification data using AI-powered analysis
    const callContext: CallContext = {
      transcript: transcript || null,
      duration: duration,
      endedReason: callData.endedReason || null,
    };

    const qualificationData = await extractQualificationData(callContext);

    // Update the lead
    const [updatedLead] = await db
      .update(schema.leads)
      .set({
        callStatus,
        callStartedAt: callData.startedAt ? new Date(callData.startedAt) : undefined,
        callEndedAt: callData.endedAt ? new Date(callData.endedAt) : new Date(),
        callDuration: duration,
        transcript: transcript || undefined,
        motivation: qualificationData.motivation,
        timeline: qualificationData.timeline,
        budget: qualificationData.budget,
        authority: qualificationData.authority,
        pastExperience: qualificationData.pastExperience,
        intent: qualificationData.intent,
        qualificationScore: qualificationData.qualificationScore,
        updatedAt: new Date(),
      })
      .where(eq(schema.leads.id, leadId))
      .returning();

    log("info", "Lead synced from Vapi", {
      leadId,
      callId: lead.callId,
      callStatus,
      intent: qualificationData.intent,
      score: qualificationData.qualificationScore,
    });

    return c.json({
      success: true,
      data: {
        synced: true,
        lead: updatedLead,
      },
      message: "Call data synced successfully",
    });
  } catch (error) {
    log("error", "Error syncing call data", {
      leadId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ success: false, error: "Error syncing call data" }, 500);
  }
});

export { webhooks };
