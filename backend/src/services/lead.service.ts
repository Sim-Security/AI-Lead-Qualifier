/**
 * Lead Service
 *
 * Provides CRUD operations for lead management using Drizzle ORM.
 * Includes filtering, pagination, and soft delete functionality.
 */

import { db } from "@/db";
import { leads, type Lead } from "@/db/schema";
import { eq, desc, asc, and, isNull, like, or, sql, count } from "drizzle-orm";
import type {
  CallStatus,
  Intent,
  CreateLeadInput,
  UpdateLeadInput,
  QualificationResult,
} from "@/types";

/**
 * Filter options for listing leads
 */
export interface LeadFilters {
  status?: CallStatus;
  intent?: Intent;
  search?: string;
  sortBy?: "createdAt" | "qualificationScore";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Paginated response structure
 */
export interface PaginatedLeads {
  leads: Lead[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Creates a new lead in the database
 *
 * @param data - Lead creation input
 * @returns The created lead
 */
export async function createLead(data: CreateLeadInput): Promise<Lead> {
  const result = await db
    .insert(leads)
    .values({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      company: data.company,
      role: data.role,
      companySize: data.companySize,
      initialRequest: data.initialRequest,
    })
    .returning();

  const lead = result[0];
  if (!lead) {
    throw new Error("Failed to create lead");
  }
  return lead;
}

/**
 * Retrieves a single lead by ID
 *
 * @param id - The lead's UUID
 * @returns The lead or null if not found
 */
export async function getLeadById(id: string): Promise<Lead | null> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), isNull(leads.deletedAt)))
    .limit(1);

  return lead || null;
}

/**
 * Lists leads with filtering, sorting, and pagination
 *
 * @param filters - Filter, sort, and pagination options
 * @returns Paginated leads with metadata
 */
export async function getLeads(filters: LeadFilters = {}): Promise<PaginatedLeads> {
  const {
    status,
    intent,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 20,
  } = filters;

  // Build where conditions
  const conditions = [isNull(leads.deletedAt)];

  if (status) {
    conditions.push(eq(leads.callStatus, status));
  }

  if (intent) {
    conditions.push(eq(leads.intent, intent));
  }

  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        like(leads.firstName, searchPattern),
        like(leads.lastName, searchPattern),
        like(leads.email, searchPattern),
        like(leads.company, searchPattern)
      )!
    );
  }

  const whereClause = and(...conditions);

  // Get total count for pagination
  const countResult = await db
    .select({ total: count() })
    .from(leads)
    .where(whereClause);
  const total = countResult[0]?.total ?? 0;

  // Build sort order
  const orderColumn = sortBy === "qualificationScore" ? leads.qualificationScore : leads.createdAt;
  const orderDirection = sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn);

  // Calculate offset
  const offset = (page - 1) * limit;

  // Get paginated results
  const results = await db
    .select()
    .from(leads)
    .where(whereClause)
    .orderBy(orderDirection)
    .limit(limit)
    .offset(offset);

  return {
    leads: results,
    pagination: {
      page,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Partially updates a lead
 *
 * @param id - The lead's UUID
 * @param data - Partial update data
 * @returns The updated lead or null if not found
 */
export async function updateLead(id: string, data: UpdateLeadInput): Promise<Lead | null> {
  // Filter out undefined values and add updatedAt
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.companySize !== undefined) updateData.companySize = data.companySize;
  if (data.initialRequest !== undefined) updateData.initialRequest = data.initialRequest;
  if (data.callStatus !== undefined) updateData.callStatus = data.callStatus;
  if (data.motivation !== undefined) updateData.motivation = data.motivation;
  if (data.timeline !== undefined) updateData.timeline = data.timeline;
  if (data.budget !== undefined) updateData.budget = data.budget;
  if (data.authority !== undefined) updateData.authority = data.authority;
  if (data.pastExperience !== undefined) updateData.pastExperience = data.pastExperience;
  if (data.intent !== undefined) updateData.intent = data.intent;
  if (data.qualificationScore !== undefined) updateData.qualificationScore = data.qualificationScore;
  if (data.transcript !== undefined) updateData.transcript = data.transcript;

  const [lead] = await db
    .update(leads)
    .set(updateData)
    .where(and(eq(leads.id, id), isNull(leads.deletedAt)))
    .returning();

  return lead || null;
}

/**
 * Soft deletes a lead by setting deletedAt timestamp
 *
 * @param id - The lead's UUID
 * @returns True if deleted, false if not found
 */
export async function softDeleteLead(id: string): Promise<boolean> {
  const [lead] = await db
    .update(leads)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, id), isNull(leads.deletedAt)))
    .returning();

  return !!lead;
}

/**
 * Updates the call status for a lead
 *
 * @param id - The lead's UUID
 * @param status - New call status
 * @param callId - Optional Vapi call ID
 * @returns The updated lead or null if not found
 */
export async function updateCallStatus(
  id: string,
  status: CallStatus,
  callId?: string
): Promise<Lead | null> {
  const updateData: Record<string, unknown> = {
    callStatus: status,
    updatedAt: new Date(),
  };

  if (callId) {
    updateData.callId = callId;
  }

  // Set call timing based on status
  if (status === "calling") {
    updateData.callStartedAt = new Date();
  } else if (status === "completed" || status === "failed" || status === "no_answer") {
    updateData.callEndedAt = new Date();
  }

  const [lead] = await db
    .update(leads)
    .set(updateData)
    .where(and(eq(leads.id, id), isNull(leads.deletedAt)))
    .returning();

  return lead || null;
}

/**
 * Updates qualification data for a lead after call analysis
 *
 * @param id - The lead's UUID
 * @param qualificationData - Extracted qualification data
 * @returns The updated lead or null if not found
 */
export async function updateQualification(
  id: string,
  qualificationData: Partial<QualificationResult> & {
    transcript?: string;
    callDuration?: number;
  }
): Promise<Lead | null> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (qualificationData.motivation !== undefined) {
    updateData.motivation = qualificationData.motivation;
  }
  if (qualificationData.timeline !== undefined) {
    updateData.timeline = qualificationData.timeline;
  }
  if (qualificationData.budget !== undefined) {
    updateData.budget = qualificationData.budget;
  }
  if (qualificationData.authority !== undefined) {
    updateData.authority = qualificationData.authority;
  }
  if (qualificationData.pastExperience !== undefined) {
    updateData.pastExperience = qualificationData.pastExperience;
  }
  if (qualificationData.intent !== undefined) {
    updateData.intent = qualificationData.intent;
  }
  if (qualificationData.qualificationScore !== undefined) {
    updateData.qualificationScore = qualificationData.qualificationScore;
  }
  if (qualificationData.transcript !== undefined) {
    updateData.transcript = qualificationData.transcript;
  }
  if (qualificationData.callDuration !== undefined) {
    updateData.callDuration = qualificationData.callDuration;
  }

  const [lead] = await db
    .update(leads)
    .set(updateData)
    .where(and(eq(leads.id, id), isNull(leads.deletedAt)))
    .returning();

  return lead || null;
}

/**
 * Gets leads by call status (useful for batch processing)
 *
 * @param status - The call status to filter by
 * @returns Array of leads with the specified status
 */
export async function getLeadsByCallStatus(status: CallStatus): Promise<Lead[]> {
  return db
    .select()
    .from(leads)
    .where(and(eq(leads.callStatus, status), isNull(leads.deletedAt)));
}

/**
 * Gets a lead by its Vapi call ID
 *
 * @param callId - The Vapi call ID
 * @returns The lead or null if not found
 */
export async function getLeadByCallId(callId: string): Promise<Lead | null> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.callId, callId), isNull(leads.deletedAt)))
    .limit(1);

  return lead || null;
}

/**
 * Gets dashboard statistics
 *
 * @returns Aggregated statistics for the dashboard
 */
export async function getDashboardStats() {
  const baseCondition = isNull(leads.deletedAt);

  // Get counts in parallel
  const [
    totalResults,
    hotResults,
    warmResults,
    coldResults,
    pendingResults,
    completedResults,
    avgScoreResults,
  ] = await Promise.all([
    db.select({ count: count() }).from(leads).where(baseCondition),
    db.select({ count: count() }).from(leads).where(and(baseCondition, eq(leads.intent, "hot"))),
    db.select({ count: count() }).from(leads).where(and(baseCondition, eq(leads.intent, "warm"))),
    db.select({ count: count() }).from(leads).where(and(baseCondition, eq(leads.intent, "cold"))),
    db.select({ count: count() }).from(leads).where(and(baseCondition, eq(leads.callStatus, "pending"))),
    db.select({ count: count() }).from(leads).where(and(baseCondition, eq(leads.callStatus, "completed"))),
    db.select({ avg: sql<number>`COALESCE(AVG(${leads.qualificationScore}), 0)` }).from(leads).where(baseCondition),
  ]);

  return {
    totalLeads: totalResults[0]?.count ?? 0,
    hotLeads: hotResults[0]?.count ?? 0,
    warmLeads: warmResults[0]?.count ?? 0,
    coldLeads: coldResults[0]?.count ?? 0,
    pendingCalls: pendingResults[0]?.count ?? 0,
    completedCalls: completedResults[0]?.count ?? 0,
    averageQualificationScore: Math.round((avgScoreResults[0]?.avg ?? 0) * 100) / 100,
  };
}
