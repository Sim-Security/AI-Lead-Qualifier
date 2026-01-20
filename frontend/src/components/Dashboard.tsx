import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { getLeads } from '@/services/api';
import type { Lead, CallStatus, LeadIntent, LeadFilters } from '@/types';

const statusOptions: { value: CallStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'calling', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'no_answer', label: 'No Answer' },
];

function getCallStatusBadgeClass(status: CallStatus): string {
  const classes: Record<CallStatus, string> = {
    pending: 'bg-secondary-100 text-secondary-800',
    calling: 'bg-primary-100 text-primary-800',
    completed: 'bg-success-100 text-success-800',
    failed: 'bg-danger-100 text-danger-800',
    no_answer: 'bg-warning-100 text-warning-800',
  };
  return `px-2 py-1 rounded-full text-xs font-medium ${classes[status] || 'bg-secondary-100 text-secondary-800'}`;
}

function getCallStatusLabel(status: CallStatus): string {
  const labels: Record<CallStatus, string> = {
    pending: 'Pending',
    calling: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    no_answer: 'No Answer',
  };
  return labels[status] || status;
}

function getIntentBadgeClass(intent: LeadIntent): string {
  const classes: Record<LeadIntent, string> = {
    hot: 'bg-danger-100 text-danger-800',
    warm: 'bg-warning-100 text-warning-800',
    cold: 'bg-blue-100 text-blue-800',
  };
  return `px-2 py-1 rounded-full text-xs font-medium uppercase ${classes[intent] || 'bg-secondary-100 text-secondary-800'}`;
}

function getScoreColor(score: number | null | undefined): string {
  if (score === undefined || score === null) return 'text-secondary-400';
  if (score >= 80) return 'text-success-600';
  if (score >= 60) return 'text-warning-600';
  return 'text-danger-600';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function LeadCardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="skeleton h-5 w-32 mb-2" />
          <div className="skeleton h-4 w-24" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-4 w-48" />
        <div className="skeleton h-4 w-40" />
      </div>
      <div className="mt-4 pt-4 border-t border-secondary-100">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4 mt-2" />
      </div>
    </div>
  );
}

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="card-hover p-5 cursor-pointer group"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-secondary-900 group-hover:text-primary-600 transition-colors">
            {lead.firstName} {lead.lastName}
          </h3>
          <p className="text-sm text-secondary-500">{lead.role || 'No role specified'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={getCallStatusBadgeClass(lead.callStatus)}>
            {getCallStatusLabel(lead.callStatus)}
          </span>
          {lead.intent && (
            <span className={getIntentBadgeClass(lead.intent)}>
              {lead.intent}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-secondary-600">
          <svg className="w-4 h-4 text-secondary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21h18M3 10h18M3 3h18v18H3z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="truncate">{lead.company}</span>
        </div>
        <div className="flex items-center gap-2 text-secondary-600">
          <svg className="w-4 h-4 text-secondary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="m22 6-10 7L2 6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="truncate">{lead.email}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-secondary-100">
        <p className="text-sm text-secondary-600 line-clamp-2">{lead.initialRequest}</p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-secondary-400">{formatDate(lead.createdAt)}</span>
        {lead.qualificationScore !== undefined && lead.qualificationScore !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-secondary-500">Score:</span>
            <span className={clsx('text-sm font-semibold', getScoreColor(lead.qualificationScore))}>
              {lead.qualificationScore}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClearFilters }: { hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-secondary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h3 className="text-lg font-medium text-secondary-900 mb-2">
        {hasFilters ? 'No leads match your filters' : 'No leads yet'}
      </h3>
      <p className="text-secondary-500 mb-6">
        {hasFilters
          ? 'Try adjusting your search or filter criteria.'
          : 'Start by submitting your first lead to see it here.'}
      </p>
      {hasFilters && (
        <button onClick={onClearFilters} className="btn-secondary">
          Clear Filters
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<LeadFilters>({
    status: undefined,
    search: '',
    page: 1,
    limit: 12,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['leads', filters],
    queryFn: () => getLeads(filters),
  });

  const hasFilters = Boolean(filters.status || filters.search);

  const stats = useMemo(() => {
    if (!data?.data) return null;

    const leads = data.data;
    const total = leads.length;
    const hotLeads = leads.filter((l) => l.intent === 'hot').length;
    const warmLeads = leads.filter((l) => l.intent === 'warm').length;
    const completed = leads.filter((l) => l.callStatus === 'completed').length;
    const scoredLeads = leads.filter((l) => l.qualificationScore !== undefined && l.qualificationScore !== null);
    const avgScore = scoredLeads.length > 0
      ? Math.round(scoredLeads.reduce((acc, l) => acc + (l.qualificationScore || 0), 0) / scoredLeads.length)
      : 0;

    return { total, hotLeads, warmLeads, completed, avgScore };
  }, [data?.data]);

  const handleClearFilters = () => {
    setFilters({ status: undefined, search: '', page: 1, limit: 12 });
  };

  return (
    <div className="animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Lead Dashboard</h1>
          <p className="text-secondary-600 mt-1">
            Manage and track your qualified leads
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          New Lead
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="card p-4">
            <p className="text-sm text-secondary-500 mb-1">Total Leads</p>
            <p className="text-2xl font-bold text-secondary-900">{stats.total}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-secondary-500 mb-1">Hot Leads</p>
            <p className="text-2xl font-bold text-danger-600">{stats.hotLeads}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-secondary-500 mb-1">Warm Leads</p>
            <p className="text-2xl font-bold text-warning-600">{stats.warmLeads}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-secondary-500 mb-1">Completed Calls</p>
            <p className="text-2xl font-bold text-success-600">{stats.completed}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-secondary-500 mb-1">Avg. Score</p>
            <p className={clsx('text-2xl font-bold', getScoreColor(stats.avgScore))}>
              {stats.avgScore || '-'}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or company..."
                value={filters.search || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={filters.status || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value as CallStatus | undefined || undefined,
                  page: 1,
                }))
              }
              className="input"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button onClick={handleClearFilters} className="btn-secondary">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="card p-6 bg-danger-50 border-danger-200 text-center">
          <svg
            className="w-12 h-12 text-danger-400 mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3 className="text-lg font-medium text-danger-800 mb-2">
            Failed to load leads
          </h3>
          <p className="text-danger-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <LeadCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Leads Grid */}
      {!isLoading && !isError && data?.data && (
        <>
          {data.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.data.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState hasFilters={hasFilters} onClearFilters={handleClearFilters} />
          )}

          {/* Pagination */}
          {data.pagination && data.pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                disabled={filters.page === 1}
                className="btn-secondary"
              >
                Previous
              </button>
              <span className="px-4 text-sm text-secondary-600">
                Page {filters.page} of {data.pagination.totalPages}
              </span>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                disabled={filters.page === data.pagination.totalPages}
                className="btn-secondary"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
