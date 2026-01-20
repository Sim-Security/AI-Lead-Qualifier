/**
 * Transcript Service
 *
 * AI-powered transcript analysis using Anthropic Claude.
 * Extracts qualification data from call transcripts using BANT framework.
 * Includes call context (duration, end reason) for accurate qualification.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getConfig, isConfigured } from "@/config/runtime-config";
import type { QualificationResult, Intent } from "@/types";

/**
 * Call context metadata for more accurate qualification
 */
export interface CallContext {
  /** Call duration in seconds */
  duration?: number | null;
  /** Why the call ended */
  endedReason?: string | null;
  /** Raw transcript text */
  transcript?: string | null;
}

/**
 * Get Anthropic client with current runtime config
 * Creates a new client each time to ensure latest config is used
 */
function getAnthropicClient(): Anthropic {
  const config = getConfig();
  if (!config.anthropicApiKey) {
    throw new Error("Anthropic API key not configured. Please configure via Settings.");
  }
  return new Anthropic({
    apiKey: config.anthropicApiKey,
  });
}

/**
 * Builds the extraction prompt for Claude to analyze transcripts
 * Includes call context for more accurate qualification
 */
function buildExtractionPrompt(context: CallContext): string {
  const contextInfo: string[] = [];

  if (context.duration !== undefined && context.duration !== null) {
    contextInfo.push(`- Call Duration: ${context.duration} seconds`);
  }
  if (context.endedReason) {
    contextInfo.push(`- How Call Ended: ${context.endedReason}`);
  }

  const contextSection = contextInfo.length > 0
    ? `\n\nCALL CONTEXT (Important for qualification):\n${contextInfo.join('\n')}\n`
    : '';

  return `You are an expert lead qualification analyst. Analyze the following call transcript between a sales qualification assistant and a potential lead.
${contextSection}
CRITICAL RULES FOR QUALIFICATION:
- If the call was very short (under 30 seconds) or the customer hung up early, this is likely a COLD lead with a LOW score
- "customer-ended-call" with short duration = disinterested, score should be 0-20
- "silence-timed-out" = no engagement, score should be 0-15
- "voicemail-reached" = couldn't reach them, score should be 10-25
- Only calls with actual conversation and engagement should score above 40

Extract the following BANT (Budget, Authority, Need, Timeline) qualification data:

1. **Motivation/Need**: What is their primary motivation or pain point? What specific problem are they trying to solve?

2. **Timeline**: When do they need a solution? Is there urgency? (Examples: "Immediate", "1-3 months", "3-6 months", "6-12 months", "No specific timeline")

3. **Budget**: What is their budget situation? Have they allocated funds? (Examples: "$0-5K", "$5K-25K", "$25K-100K", "$100K+", "Not discussed", "TBD")

4. **Authority**: Are they the decision maker? Who else is involved? (Examples: "Decision maker", "Influencer", "User/Evaluator", "Unknown")

5. **Past Experience**: Have they used similar solutions before? What was their experience?

Based on your analysis, also determine:

6. **Intent Classification**: Classify the lead as "hot", "warm", or "cold" based on:
   - HOT: Clear need, budget available, decision maker, urgent timeline (within 3 months), actively seeking solution, engaged throughout call
   - WARM: Interested but missing 1-2 key factors (budget not confirmed, longer timeline, needs approval), had meaningful conversation
   - COLD: Hung up early, no clear timeline, budget concerns, just exploring, low/no engagement, very short call

7. **Qualification Score (0-100)**: Calculate based on:
   - Engagement (25 points): Full conversation = 25, Partial = 15, Hung up early = 0, No answer = 0
   - Urgency (25 points): Immediate need = 25, 1-3 months = 20, 3-6 months = 15, 6-12 months = 10, No timeline = 5
   - Budget (25 points): Budget confirmed = 25, Likely available = 20, TBD = 10, Budget concerns = 5
   - Authority (25 points): Decision maker = 25, Strong influencer = 20, Influencer = 15, User only = 10

Respond ONLY with a valid JSON object in the following format (no markdown, no explanation):
{
  "motivation": "string describing their motivation and need",
  "timeline": "string describing timeline",
  "budget": "string describing budget situation",
  "authority": "string describing authority level",
  "pastExperience": "string describing past experience with similar solutions",
  "intent": "hot" | "warm" | "cold",
  "qualificationScore": number between 0 and 100
}`;
}

/**
 * Extracts qualification data from a call using Claude AI
 * Handles edge cases like hangups and short calls without needing AI
 *
 * @param context - Call context including transcript, duration, and end reason
 * @returns Structured qualification data
 */
export async function extractQualificationData(
  context: CallContext
): Promise<QualificationResult> {
  const { transcript, duration, endedReason } = context;

  // Check for obvious cold lead signals first (no AI needed)
  const coldLeadResult = checkForColdLeadSignals(context);
  if (coldLeadResult) {
    console.log("[TranscriptService] Cold lead detected from call signals", {
      duration,
      endedReason,
    });
    return coldLeadResult;
  }

  // If no Anthropic key configured, use fallback analysis
  if (!isConfigured()) {
    console.warn("[TranscriptService] Anthropic API not configured, using fallback analysis");
    return fallbackAnalysis(context);
  }

  try {
    // Validate transcript
    if (!transcript || transcript.trim().length === 0) {
      console.warn("[TranscriptService] Empty transcript provided, returning cold lead values");
      return getColdLeadResult("No conversation recorded");
    }

    // Clean and truncate transcript if too long (Claude has context limits)
    const cleanedTranscript = transcript.trim();
    const maxLength = 15000; // Safe limit for transcript content
    const truncatedTranscript = cleanedTranscript.length > maxLength
      ? cleanedTranscript.substring(0, maxLength) + "\n...[transcript truncated]"
      : cleanedTranscript;

    const response = await getAnthropicClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${buildExtractionPrompt(context)}\n\n--- TRANSCRIPT START ---\n${truncatedTranscript}\n--- TRANSCRIPT END ---`,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.error("[TranscriptService] No text content in Claude response");
      return fallbackAnalysis(context);
    }

    // Parse JSON response
    const jsonText = textContent.text.trim();
    const result = parseQualificationJson(jsonText);

    // Validate and sanitize the result
    return validateQualificationResult(result);
  } catch (error) {
    console.error("[TranscriptService] Error extracting qualification data:", error);

    // Return fallback analysis on error
    return fallbackAnalysis(context);
  }
}

/**
 * Check for obvious cold lead signals that don't require AI analysis
 */
function checkForColdLeadSignals(context: CallContext): QualificationResult | null {
  const { duration, endedReason } = context;

  // Very short call (under 15 seconds) - definitely cold
  if (duration !== undefined && duration !== null && duration < 15) {
    return getColdLeadResult("Call ended immediately - no engagement");
  }

  // Customer hung up quickly (under 30 seconds)
  if (
    endedReason === "customer-ended-call" &&
    duration !== undefined &&
    duration !== null &&
    duration < 30
  ) {
    return getColdLeadResult("Customer hung up early - not interested");
  }

  // Silence timeout - no engagement at all
  if (endedReason === "silence-timed-out") {
    return {
      motivation: "No engagement - call timed out due to silence",
      timeline: "Unknown",
      budget: "Unknown",
      authority: "Unknown",
      pastExperience: "Unknown",
      intent: "cold",
      qualificationScore: 5,
    };
  }

  // Voicemail - couldn't reach them
  if (endedReason === "voicemail-reached") {
    return {
      motivation: "Could not reach - went to voicemail",
      timeline: "Unknown",
      budget: "Unknown",
      authority: "Unknown",
      pastExperience: "Unknown",
      intent: "cold",
      qualificationScore: 15,
    };
  }

  // Technical failure
  if (
    endedReason === "pipeline-error-exceeded-max-retries" ||
    endedReason === "phone-call-provider-closed-websocket"
  ) {
    return {
      motivation: "Call failed due to technical issues",
      timeline: "Unknown",
      budget: "Unknown",
      authority: "Unknown",
      pastExperience: "Unknown",
      intent: "cold",
      qualificationScore: 10,
    };
  }

  return null; // No obvious cold signals, proceed with AI analysis
}

/**
 * Fallback analysis when Anthropic is not available
 * Uses basic keyword matching and call signals
 */
function fallbackAnalysis(context: CallContext): QualificationResult {
  const { transcript, duration, endedReason } = context;

  // Start with base score influenced by call signals
  let score = 30; // Lower base than before

  // Penalize short calls heavily
  if (duration !== undefined && duration !== null) {
    if (duration < 30) score -= 20;
    else if (duration < 60) score -= 10;
    else if (duration > 180) score += 15; // Reward longer conversations
    else if (duration > 120) score += 10;
  }

  // Penalize customer-ended-call
  if (endedReason === "customer-ended-call") {
    score -= 15;
  }

  // Analyze transcript if available
  if (transcript && transcript.trim().length > 0) {
    const lowerTranscript = transcript.toLowerCase();

    // Positive signals
    const positiveSignals = ["interested", "need", "want", "looking for", "excited", "great", "perfect", "yes", "tell me more"];
    const negativeSignals = ["not interested", "maybe later", "not sure", "too expensive", "busy", "no thanks", "goodbye", "not right now"];

    for (const signal of positiveSignals) {
      if (lowerTranscript.includes(signal)) score += 5;
    }
    for (const signal of negativeSignals) {
      if (lowerTranscript.includes(signal)) score -= 10;
    }
  } else {
    // No transcript = no conversation = cold
    score -= 20;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine intent based on score
  let intent: Intent;
  if (score >= 60) {
    intent = "hot";
  } else if (score >= 35) {
    intent = "warm";
  } else {
    intent = "cold";
  }

  return {
    motivation: "Analysis performed without AI - limited data available",
    timeline: "Not determined",
    budget: "Not determined",
    authority: "Not determined",
    pastExperience: "Not determined",
    intent,
    qualificationScore: score,
  };
}

/**
 * Returns a cold lead result with custom motivation
 */
function getColdLeadResult(motivation: string): QualificationResult {
  return {
    motivation,
    timeline: "Unknown",
    budget: "Unknown",
    authority: "Unknown",
    pastExperience: "Unknown",
    intent: "cold",
    qualificationScore: 10,
  };
}

/**
 * Parses JSON from Claude's response, handling potential formatting issues
 *
 * @param jsonText - Raw JSON text from Claude
 * @returns Parsed qualification data
 */
function parseQualificationJson(jsonText: string): Partial<QualificationResult> {
  try {
    // Try direct parse first
    return JSON.parse(jsonText);
  } catch {
    // Try to extract JSON from potential markdown code blocks
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        console.error("[TranscriptService] Failed to parse JSON from code block");
      }
    }

    // Try to find JSON object pattern
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        console.error("[TranscriptService] Failed to parse JSON object pattern");
      }
    }

    console.error("[TranscriptService] Could not parse qualification JSON:", jsonText);
    return {};
  }
}

/**
 * Validates and sanitizes the qualification result
 *
 * @param result - Potentially incomplete qualification data
 * @returns Complete, validated qualification result
 */
function validateQualificationResult(result: Partial<QualificationResult>): QualificationResult {
  // Validate intent
  const validIntents: Intent[] = ["hot", "warm", "cold"];
  const intent: Intent = validIntents.includes(result.intent as Intent)
    ? (result.intent as Intent)
    : "cold";

  // Validate and clamp qualification score
  let score = typeof result.qualificationScore === "number"
    ? result.qualificationScore
    : 0;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    motivation: result.motivation || "Not identified during call",
    timeline: result.timeline || "Not discussed",
    budget: result.budget || "Not discussed",
    authority: result.authority || "Unknown",
    pastExperience: result.pastExperience || "Not discussed",
    intent,
    qualificationScore: score,
  };
}

/**
 * Returns default qualification result for error cases or empty transcripts
 *
 * @returns Default qualification data
 */
function getDefaultQualificationResult(): QualificationResult {
  return {
    motivation: "Unable to determine - transcript analysis failed",
    timeline: "Unknown",
    budget: "Unknown",
    authority: "Unknown",
    pastExperience: "Unknown",
    intent: "cold",
    qualificationScore: 0,
  };
}

/**
 * Generates a summary of the call from the transcript
 * Useful for quick review of call outcomes
 *
 * @param transcript - The full call transcript text
 * @returns A brief summary of the call
 */
export async function generateCallSummary(transcript: string): Promise<string> {
  try {
    if (!transcript || transcript.trim().length === 0) {
      return "No transcript available for summary.";
    }

    const response = await getAnthropicClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Provide a 2-3 sentence summary of this sales qualification call. Focus on the lead's interest level, key concerns, and next steps if any.\n\nTranscript:\n${transcript.substring(0, 10000)}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return "Unable to generate summary.";
    }

    return textContent.text.trim();
  } catch (error) {
    console.error("[TranscriptService] Error generating call summary:", error);
    return "Error generating summary.";
  }
}

/**
 * Analyzes sentiment of the call
 *
 * @param transcript - The full call transcript text
 * @returns Sentiment analysis (positive, neutral, negative) with confidence
 */
export async function analyzeSentiment(
  transcript: string
): Promise<{ sentiment: "positive" | "neutral" | "negative"; confidence: number }> {
  try {
    if (!transcript || transcript.trim().length === 0) {
      return { sentiment: "neutral", confidence: 0 };
    }

    const response = await getAnthropicClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 64,
      messages: [
        {
          role: "user",
          content: `Analyze the sentiment of this sales call transcript. Respond with JSON only: {"sentiment": "positive" | "neutral" | "negative", "confidence": 0-100}\n\nTranscript:\n${transcript.substring(0, 5000)}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return { sentiment: "neutral", confidence: 0 };
    }

    const result = JSON.parse(textContent.text.trim());
    const validSentiments = ["positive", "neutral", "negative"];

    return {
      sentiment: validSentiments.includes(result.sentiment) ? result.sentiment : "neutral",
      confidence: Math.max(0, Math.min(100, result.confidence || 0)),
    };
  } catch (error) {
    console.error("[TranscriptService] Error analyzing sentiment:", error);
    return { sentiment: "neutral", confidence: 0 };
  }
}
