/**
 * Transcript Service
 *
 * AI-powered transcript analysis using Anthropic Claude.
 * Extracts qualification data from call transcripts using BANT framework.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "@/config/runtime-config";
import type { QualificationResult, Intent } from "@/types";

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
 * The extraction prompt for Claude to analyze transcripts
 */
const EXTRACTION_PROMPT = `You are an expert lead qualification analyst. Analyze the following call transcript between a sales qualification assistant and a potential lead.

Extract the following BANT (Budget, Authority, Need, Timeline) qualification data:

1. **Motivation/Need**: What is their primary motivation or pain point? What specific problem are they trying to solve?

2. **Timeline**: When do they need a solution? Is there urgency? (Examples: "Immediate", "1-3 months", "3-6 months", "6-12 months", "No specific timeline")

3. **Budget**: What is their budget situation? Have they allocated funds? (Examples: "$0-5K", "$5K-25K", "$25K-100K", "$100K+", "Not discussed", "TBD")

4. **Authority**: Are they the decision maker? Who else is involved? (Examples: "Decision maker", "Influencer", "User/Evaluator", "Unknown")

5. **Past Experience**: Have they used similar solutions before? What was their experience?

Based on your analysis, also determine:

6. **Intent Classification**: Classify the lead as "hot", "warm", or "cold" based on:
   - HOT: Clear need, budget available, decision maker, urgent timeline (within 3 months), actively seeking solution
   - WARM: Interested but missing 1-2 key factors (budget not confirmed, longer timeline, needs approval)
   - COLD: No clear timeline, budget concerns, just exploring, low engagement

7. **Qualification Score (0-100)**: Calculate based on:
   - Urgency (25 points): Immediate need = 25, 1-3 months = 20, 3-6 months = 15, 6-12 months = 10, No timeline = 5
   - Budget (25 points): Budget confirmed = 25, Likely available = 20, TBD = 10, Budget concerns = 5
   - Authority (25 points): Decision maker = 25, Strong influencer = 20, Influencer = 15, User only = 10
   - Need Clarity (25 points): Clear problem statement = 25, Some understanding = 15, Vague = 5

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

/**
 * Extracts qualification data from a call transcript using Claude AI
 *
 * @param transcript - The full call transcript text
 * @returns Structured qualification data
 */
export async function extractQualificationData(
  transcript: string
): Promise<QualificationResult> {
  try {
    // Validate input
    if (!transcript || transcript.trim().length === 0) {
      console.warn("[TranscriptService] Empty transcript provided, returning default values");
      return getDefaultQualificationResult();
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
          content: `${EXTRACTION_PROMPT}\n\n--- TRANSCRIPT START ---\n${truncatedTranscript}\n--- TRANSCRIPT END ---`,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.error("[TranscriptService] No text content in Claude response");
      return getDefaultQualificationResult();
    }

    // Parse JSON response
    const jsonText = textContent.text.trim();
    const result = parseQualificationJson(jsonText);

    // Validate and sanitize the result
    return validateQualificationResult(result);
  } catch (error) {
    console.error("[TranscriptService] Error extracting qualification data:", error);

    // Return default values on error
    return getDefaultQualificationResult();
  }
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
