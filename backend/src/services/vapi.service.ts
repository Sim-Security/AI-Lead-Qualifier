/**
 * Vapi AI Voice Agent Service
 *
 * Handles outbound calls for lead qualification using Vapi's AI voice platform.
 * Uses transient assistant configuration for flexible call setup.
 */

import { VapiClient } from "@vapi-ai/server-sdk";
import { env } from "@/config/env";
import { getConfig } from "@/config/runtime-config";

/**
 * Get Vapi client with current runtime config
 * Creates a new client each time to ensure latest config is used
 */
function getVapiClient(): VapiClient {
  const config = getConfig();
  if (!config.vapiApiKey) {
    throw new Error("Vapi API key not configured. Please configure via Settings.");
  }
  return new VapiClient({
    token: config.vapiApiKey,
  });
}

/**
 * System prompt for the lead qualification assistant
 * Uses BANT framework: Budget, Authority, Need, Timeline
 */
const getQualificationSystemPrompt = (leadData: LeadCallData): string => `
You are a professional lead qualification specialist conducting a brief phone call.
Your goal is to qualify the lead using the BANT framework while being conversational and friendly.

LEAD CONTEXT:
- Name: ${leadData.firstName} ${leadData.lastName}
- Company: ${leadData.company}
- Role: ${leadData.role || "Not specified"}
- Initial Request: ${leadData.initialRequest}

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

End the call by thanking them and letting them know someone will follow up with more information based on their needs.
`;

/**
 * Lead data required for initiating a call
 */
export interface LeadCallData {
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  role?: string | null;
  initialRequest: string;
}

/**
 * Call initiation response
 */
export interface CallInitiationResult {
  success: boolean;
  callId?: string;
  error?: string;
}

/**
 * Call status response from Vapi
 */
export interface CallStatusResult {
  callId: string;
  status: string;
  duration?: number;
  transcript?: string;
  startedAt?: string;
  endedAt?: string;
  error?: string;
}

/**
 * Initiates an outbound qualification call to a lead
 *
 * @param leadId - The database ID of the lead
 * @param leadData - Lead information for personalizing the call
 * @returns Call initiation result with callId on success
 */
export async function initiateCall(
  leadId: string,
  leadData: LeadCallData
): Promise<CallInitiationResult> {
  try {
    const serverUrl = env.VAPI_SERVER_URL || `http://localhost:${env.PORT}`;

    const vapiClient = getVapiClient();
    const call = await vapiClient.calls.create({
      // Customer phone number to call
      customer: {
        number: leadData.phone,
        name: `${leadData.firstName} ${leadData.lastName}`,
      },

      // Transient assistant configuration (not pre-created)
      assistant: {
        name: "Lead Qualification Assistant",

        // Voice configuration - ElevenLabs provider
        voice: {
          provider: "11labs",
          voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - professional female voice
          stability: 0.5,
          similarityBoost: 0.75,
          model: "eleven_turbo_v2",
        },

        // LLM configuration - GPT-4
        model: {
          provider: "openai",
          model: "gpt-4",
          temperature: 0.7,
          maxTokens: 500,
          messages: [
            {
              role: "system",
              content: getQualificationSystemPrompt(leadData),
            },
          ],
        },

        // First message personalized with lead name
        firstMessage: `Hello, is this ${leadData.firstName}? Hi ${leadData.firstName}, this is your AI assistant calling about your recent inquiry regarding ${leadData.initialRequest}. Do you have a few minutes to chat?`,

        // Call settings
        endCallMessage: "Thank you so much for your time today. Someone from our team will follow up with you soon. Have a great day!",

        // Transcription settings
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
        },

        // Server configuration for webhooks
        server: {
          url: `${serverUrl}/api/webhooks/vapi`,
        },
        serverMessages: [
          "end-of-call-report",
          "status-update",
          "transcript",
        ],

        // Additional settings
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 300, // 5 minutes max
        backgroundSound: "office",

        // Metadata for webhook identification
        metadata: {
          leadId,
          source: "ai-lead-qualifier",
        },
      },
    });

    return {
      success: true,
      callId: call.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error initiating call";
    console.error(`[VapiService] Failed to initiate call for lead ${leadId}:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Retrieves the current status of a call
 *
 * @param callId - The Vapi call ID
 * @returns Call status with transcript if available
 */
export async function getCallStatus(callId: string): Promise<CallStatusResult> {
  try {
    const vapiClient = getVapiClient();
    const call = await vapiClient.calls.get(callId);

    // Calculate duration if both timestamps exist
    let duration: number | undefined;
    if (call.endedAt && call.startedAt) {
      duration = Math.floor(
        (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
      );
    }

    // Access transcript from call object - may be in different locations depending on SDK version
    const callAny = call as unknown as Record<string, unknown>;
    const transcript = typeof callAny.transcript === "string" ? callAny.transcript : undefined;

    const result: CallStatusResult = {
      callId: call.id,
      status: call.status || "unknown",
    };

    if (duration !== undefined) {
      result.duration = duration;
    }
    if (transcript !== undefined) {
      result.transcript = transcript;
    }
    if (call.startedAt) {
      result.startedAt = call.startedAt;
    }
    if (call.endedAt) {
      result.endedAt = call.endedAt;
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error getting call status";
    console.error(`[VapiService] Failed to get status for call ${callId}:`, errorMessage);

    return {
      callId,
      status: "error",
      error: errorMessage,
    };
  }
}

/**
 * Forces the end of an active call
 *
 * @param callId - The Vapi call ID to end
 * @returns Success status
 */
export async function endCall(callId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const vapiClient = getVapiClient();
    const config = getConfig();

    await vapiClient.calls.update(callId, {
      // Setting status to ended will terminate the call
    });

    // Vapi SDK may not have a direct end method, try using the update or a specific endpoint
    // Alternative approach: use the REST API directly if SDK doesn't support
    const response = await fetch(`https://api.vapi.ai/call/${callId}/stop`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.vapiApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to end call: ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error ending call";
    console.error(`[VapiService] Failed to end call ${callId}:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}
