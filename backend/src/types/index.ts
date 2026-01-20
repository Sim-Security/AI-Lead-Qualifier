import type { Lead as DbLead, NewLead as DbNewLead } from "@/db/schema.ts";

// Re-export database types
export type Lead = DbLead;
export type NewLead = DbNewLead;

// Enum types for frontend
export const CallStatus = {
  PENDING: "pending",
  CALLING: "calling",
  COMPLETED: "completed",
  FAILED: "failed",
  NO_ANSWER: "no_answer",
} as const;

export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const Intent = {
  HOT: "hot",
  WARM: "warm",
  COLD: "cold",
} as const;

export type Intent = (typeof Intent)[keyof typeof Intent];

export const CompanySize = {
  TINY: "1-10",
  SMALL: "11-50",
  MEDIUM: "51-200",
  LARGE: "201-500",
  ENTERPRISE: "501-1000",
  CORPORATION: "1000+",
} as const;

export type CompanySize = (typeof CompanySize)[keyof typeof CompanySize];

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Lead DTOs
export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  role?: string;
  companySize?: CompanySize;
  initialRequest: string;
}

export interface UpdateLeadInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  companySize?: CompanySize;
  initialRequest?: string;
  callStatus?: CallStatus;
  motivation?: string;
  timeline?: string;
  budget?: string;
  authority?: string;
  pastExperience?: string;
  intent?: Intent;
  qualificationScore?: number;
  transcript?: string;
}

// Call-related types
export interface InitiateCallInput {
  leadId: string;
}

export interface CallWebhookPayload {
  callId: string;
  status: CallStatus;
  duration?: number;
  transcript?: string;
  startedAt?: string;
  endedAt?: string;
}

// Qualification result from AI
export interface QualificationResult {
  motivation: string;
  timeline: string;
  budget: string;
  authority: string;
  pastExperience: string;
  intent: Intent;
  qualificationScore: number;
}

// Dashboard statistics
export interface DashboardStats {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  pendingCalls: number;
  completedCalls: number;
  averageQualificationScore: number;
}
