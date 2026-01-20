/**
 * Services Index
 *
 * Re-exports all services for clean imports throughout the application.
 * Usage: import { createLead, initiateCall, extractQualificationData } from "@/services";
 */

// Vapi Voice Agent Service
export {
  initiateCall,
  getCallStatus,
  endCall,
  type LeadCallData,
  type CallInitiationResult,
  type CallStatusResult,
} from "./vapi.service";

// Lead CRUD Service
export {
  createLead,
  getLeadById,
  getLeads,
  updateLead,
  softDeleteLead,
  updateCallStatus,
  updateQualification,
  getLeadsByCallStatus,
  getLeadByCallId,
  getDashboardStats,
  type LeadFilters,
  type PaginatedLeads,
} from "./lead.service";

// Transcript Analysis Service
export {
  extractQualificationData,
  generateCallSummary,
  analyzeSentiment,
  type CallContext,
} from "./transcript.service";
