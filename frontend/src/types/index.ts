// Call status enum matching backend
export type CallStatus = 'pending' | 'calling' | 'completed' | 'failed' | 'no_answer';

// Lead intent classification
export type LeadIntent = 'hot' | 'warm' | 'cold';

// Company size options
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';

// Lead interface matching backend schema
export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  role?: string | null;
  companySize?: CompanySize | null;
  initialRequest: string;
  callId?: string | null;
  callStatus: CallStatus;
  callDuration?: number | null;
  callStartedAt?: string | null;
  callEndedAt?: string | null;
  motivation?: string | null;
  timeline?: string | null;
  budget?: string | null;
  authority?: string | null;
  pastExperience?: string | null;
  intent?: LeadIntent | null;
  qualificationScore?: number | null;
  transcript?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// Form input for creating a new lead
export interface LeadFormInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company: string;
  role: string;
  companySize: CompanySize;
  request: string; // Maps to initialRequest on backend
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>;
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

// Lead filters for dashboard
export interface LeadFilters {
  status?: CallStatus;
  intent?: LeadIntent;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'qualificationScore' | 'company' | 'callStatus' | 'intent';
  sortOrder?: 'asc' | 'desc';
}

// Lead update payload
export interface LeadUpdateInput {
  callStatus?: CallStatus;
  motivation?: string | null;
  timeline?: string | null;
  budget?: string | null;
  authority?: string | null;
  pastExperience?: string | null;
  intent?: LeadIntent | null;
  qualificationScore?: number | null;
  transcript?: string | null;
}

// Stats for dashboard
export interface DashboardStats {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  pendingLeads: number;
  completedCalls: number;
  averageScore: number;
}
