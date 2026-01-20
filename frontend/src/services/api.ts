import type {
  Lead,
  LeadFormInput,
  LeadUpdateInput,
  LeadFilters,
  ApiResponse,
  PaginatedResponse,
  DashboardStats,
} from '@/types';

// Base URL from environment variable, fallback to /api for proxy
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Generic fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
}

// Build query string from filters
function buildQueryString(filters: LeadFilters): string {
  const params = new URLSearchParams();

  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

// Submit a new lead (via webhook to trigger call)
export async function submitLead(input: LeadFormInput): Promise<ApiResponse<{ leadId: string; callInitiated: boolean }>> {
  // Map frontend field names to backend webhook expectations
  const webhookPayload = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    company: input.company,
    role: input.role,
    companySize: input.companySize,
    initialRequest: input.request, // Map 'request' to 'initialRequest'
  };

  return fetchApi<ApiResponse<{ leadId: string; callInitiated: boolean }>>('/webhooks/form', {
    method: 'POST',
    body: JSON.stringify(webhookPayload),
  });
}

// Get all leads with optional filters
export async function getLeads(filters: LeadFilters = {}): Promise<PaginatedResponse<Lead>> {
  const queryString = buildQueryString(filters);
  return fetchApi<PaginatedResponse<Lead>>(`/leads${queryString}`);
}

// Get a single lead by ID
export async function getLead(id: string): Promise<ApiResponse<Lead>> {
  return fetchApi<ApiResponse<Lead>>(`/leads/${id}`);
}

// Update a lead
export async function updateLead(
  id: string,
  input: LeadUpdateInput
): Promise<ApiResponse<Lead>> {
  return fetchApi<ApiResponse<Lead>>(`/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// Delete a lead
export async function deleteLead(id: string): Promise<ApiResponse<void>> {
  return fetchApi<ApiResponse<void>>(`/leads/${id}`, {
    method: 'DELETE',
  });
}

// Get dashboard statistics
export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  return fetchApi<ApiResponse<DashboardStats>>('/leads/stats');
}

// Trigger AI analysis for a lead
export async function analyzeLead(id: string): Promise<ApiResponse<Lead>> {
  return fetchApi<ApiResponse<Lead>>(`/leads/${id}/analyze`, {
    method: 'POST',
  });
}

// Sync call data from Vapi for a lead
export async function syncLead(id: string): Promise<ApiResponse<{ synced: boolean; lead?: Lead; reason?: string }>> {
  return fetchApi<ApiResponse<{ synced: boolean; lead?: Lead; reason?: string }>>(`/webhooks/sync/${id}`, {
    method: 'POST',
  });
}

// Health check
export async function healthCheck(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>('/health');
}
