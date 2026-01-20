// =============================================================================
// Lead Status & Classification Types
// =============================================================================

/**
 * Lead processing status
 * - pending: Lead submitted, awaiting call
 * - calling: Call in progress
 * - completed: Call finished successfully
 * - failed: Call failed due to error
 * - no_answer: Lead did not answer the call
 */
export type LeadStatus = 'pending' | 'calling' | 'completed' | 'failed' | 'no_answer';

/**
 * Lead intent classification based on qualification call
 * - hot: High intent, ready to buy
 * - warm: Interested but not ready
 * - cold: Low intent or not a fit
 * - null: Not yet qualified
 */
export type LeadIntent = 'hot' | 'warm' | 'cold' | null;

/**
 * Company size brackets
 */
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '500+';

// =============================================================================
// Lead Data Types
// =============================================================================

/**
 * Data collected from the lead submission form
 */
export interface LeadFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  companySize: CompanySize;
  request: string;
}

/**
 * Complete lead record with all tracking and qualification data
 */
export interface Lead extends LeadFormData {
  id: string;

  // Call tracking
  callId: string | null;
  callStatus: LeadStatus;
  callDuration: number | null;
  callStartedAt: string | null;
  callEndedAt: string | null;

  // Qualification data (extracted from call)
  motivation: string | null;
  timeline: string | null;
  budget: string | null;
  authority: string | null;
  pastExperience: string | null;
  intent: LeadIntent;
  qualificationScore: number | null;

  // Transcript
  transcript: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated API response for list endpoints
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// Vapi Webhook Event Types
// =============================================================================

/**
 * Event fired when a call starts
 */
export interface VapiCallStartedEvent {
  type: 'call-started';
  callId: string;
  leadId: string;
  startedAt: string;
}

/**
 * Event fired when a call ends successfully or with a known outcome
 */
export interface VapiCallEndedEvent {
  type: 'call-ended';
  callId: string;
  leadId: string;
  duration: number;
  transcript: string;
  endReason: 'completed' | 'no-answer' | 'voicemail' | 'busy' | 'failed' | 'max-duration';
}

/**
 * Event fired when a call fails due to an error
 */
export interface VapiCallFailedEvent {
  type: 'call-failed';
  callId: string;
  leadId: string;
  error: string;
}

/**
 * Union type of all possible Vapi webhook events
 */
export type VapiWebhookEvent = VapiCallStartedEvent | VapiCallEndedEvent | VapiCallFailedEvent;

// =============================================================================
// Qualification Types
// =============================================================================

/**
 * Structured qualification data extracted from call transcript
 */
export interface QualificationData {
  motivation: string | null;
  timeline: string | null;
  budget: string | null;
  authority: string | null;
  pastExperience: string | null;
  intent: LeadIntent;
  qualificationScore: number;
}
