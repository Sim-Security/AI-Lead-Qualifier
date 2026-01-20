import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { getLead, deleteLead, analyzeLead, syncLead } from '@/services/api';
import type { CallStatus, LeadIntent } from '@/types';

function getCallStatusBadgeClass(status: CallStatus): string {
  const classes: Record<CallStatus, string> = {
    pending: 'bg-secondary-100 text-secondary-800',
    calling: 'bg-primary-100 text-primary-800',
    completed: 'bg-success-100 text-success-800',
    failed: 'bg-danger-100 text-danger-800',
    no_answer: 'bg-warning-100 text-warning-800',
  };
  return classes[status] || 'bg-secondary-100 text-secondary-800';
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
    hot: 'bg-danger-100 text-danger-800 border border-danger-200',
    warm: 'bg-warning-100 text-warning-800 border border-warning-200',
    cold: 'bg-blue-100 text-blue-800 border border-blue-200',
  };
  return classes[intent] || 'bg-secondary-100 text-secondary-800';
}

function getScoreColor(score: number | null | undefined): string {
  if (score === undefined || score === null) return 'text-secondary-400';
  if (score >= 80) return 'text-success-600';
  if (score >= 60) return 'text-warning-600';
  return 'text-danger-600';
}

function getScoreBgColor(score: number | null | undefined): string {
  if (score === undefined || score === null) return 'bg-secondary-100';
  if (score >= 80) return 'bg-success-100';
  if (score >= 60) return 'bg-warning-100';
  return 'bg-danger-100';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === undefined || seconds === null) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-4 mb-8">
        <div className="skeleton h-10 w-24" />
        <div className="skeleton h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="skeleton h-6 w-32 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="skeleton h-4 w-20 mb-2" />
                  <div className="skeleton h-5 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6">
            <div className="skeleton h-6 w-24 mb-4" />
            <div className="skeleton h-20 w-full" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="card p-6">
            <div className="skeleton h-6 w-24 mb-4" />
            <div className="skeleton h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => getLead(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLead(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      navigate('/dashboard');
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeLead(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncLead(id!),
    onSuccess: (response) => {
      if (response.data?.synced) {
        queryClient.invalidateQueries({ queryKey: ['lead', id] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-danger-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-secondary-900 mb-2">Lead Not Found</h2>
        <p className="text-secondary-600 mb-6">
          {error instanceof Error ? error.message : 'The lead you are looking for does not exist.'}
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const lead = data?.data;
  if (!lead) return null;

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-secondary p-2"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">
              {lead.firstName} {lead.lastName}
            </h1>
            <p className="text-secondary-500">{lead.role || 'No role specified'} at {lead.company}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Sync button - shown when call is in progress or needs sync */}
          {(lead.callStatus === 'calling' || (lead.callId && !lead.transcript)) && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="btn-primary"
              title="Sync call data from Vapi"
            >
              {syncMutation.isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16 16h5v5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Sync Call Data
                </>
              )}
            </button>
          )}
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending || lead.callStatus !== 'completed'}
            className="btn-secondary"
            title={lead.callStatus !== 'completed' ? 'Call must be completed first' : 'Run AI Analysis'}
          >
            {analyzeMutation.isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5v5l4 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Run AI Analysis
              </>
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="btn-danger"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-secondary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Contact Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-secondary-500 mb-1">Full Name</p>
                <p className="font-medium text-secondary-900">{lead.firstName} {lead.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-secondary-500 mb-1">Email</p>
                <a href={`mailto:${lead.email}`} className="font-medium text-primary-600 hover:text-primary-700">
                  {lead.email}
                </a>
              </div>
              {lead.phone && (
                <div>
                  <p className="text-sm text-secondary-500 mb-1">Phone</p>
                  <a href={`tel:${lead.phone}`} className="font-medium text-primary-600 hover:text-primary-700">
                    {lead.phone}
                  </a>
                </div>
              )}
              <div>
                <p className="text-sm text-secondary-500 mb-1">Company</p>
                <p className="font-medium text-secondary-900">{lead.company}</p>
              </div>
              {lead.role && (
                <div>
                  <p className="text-sm text-secondary-500 mb-1">Role</p>
                  <p className="font-medium text-secondary-900">{lead.role}</p>
                </div>
              )}
              {lead.companySize && (
                <div>
                  <p className="text-sm text-secondary-500 mb-1">Company Size</p>
                  <p className="font-medium text-secondary-900">{lead.companySize} employees</p>
                </div>
              )}
            </div>
          </div>

          {/* Initial Request */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-secondary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Initial Request
            </h2>
            <p className="text-secondary-700 whitespace-pre-wrap leading-relaxed">{lead.initialRequest}</p>
          </div>

          {/* BANT Qualification Results */}
          {(lead.budget || lead.authority || lead.motivation || lead.timeline || lead.pastExperience) && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-secondary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                BANT Qualification
              </h2>
              <div className="space-y-4">
                {lead.budget && (
                  <div className="p-4 bg-secondary-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-secondary-700 mb-1 flex items-center gap-2">
                      <span className="text-success-600">B</span> Budget
                    </h3>
                    <p className="text-secondary-600">{lead.budget}</p>
                  </div>
                )}
                {lead.authority && (
                  <div className="p-4 bg-secondary-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-secondary-700 mb-1 flex items-center gap-2">
                      <span className="text-primary-600">A</span> Authority
                    </h3>
                    <p className="text-secondary-600">{lead.authority}</p>
                  </div>
                )}
                {lead.motivation && (
                  <div className="p-4 bg-secondary-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-secondary-700 mb-1 flex items-center gap-2">
                      <span className="text-warning-600">N</span> Need / Motivation
                    </h3>
                    <p className="text-secondary-600">{lead.motivation}</p>
                  </div>
                )}
                {lead.timeline && (
                  <div className="p-4 bg-secondary-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-secondary-700 mb-1 flex items-center gap-2">
                      <span className="text-danger-600">T</span> Timeline
                    </h3>
                    <p className="text-secondary-600">{lead.timeline}</p>
                  </div>
                )}
                {lead.pastExperience && (
                  <div className="p-4 bg-secondary-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-secondary-700 mb-1">Past Experience</h3>
                    <p className="text-secondary-600">{lead.pastExperience}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Call Transcript */}
          {lead.transcript && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-secondary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Call Transcript
              </h2>
              <div className="bg-secondary-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-secondary-700 whitespace-pre-wrap font-mono">{lead.transcript}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Call Status & Score */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Call Status</h2>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium', getCallStatusBadgeClass(lead.callStatus))}>
                {getCallStatusLabel(lead.callStatus)}
              </span>
              {lead.intent && (
                <span className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium uppercase', getIntentBadgeClass(lead.intent))}>
                  {lead.intent}
                </span>
              )}
            </div>

            {/* Score Display */}
            {lead.qualificationScore !== null && lead.qualificationScore !== undefined && (
              <div className={clsx('p-4 rounded-xl mb-4', getScoreBgColor(lead.qualificationScore))}>
                <p className="text-sm text-secondary-600 mb-1">Qualification Score</p>
                <p className={clsx('text-3xl font-bold', getScoreColor(lead.qualificationScore))}>
                  {lead.qualificationScore}/100
                </p>
              </div>
            )}

            {/* Call Details */}
            {lead.callId && (
              <div className="space-y-3 pt-4 border-t border-secondary-200">
                <div>
                  <p className="text-sm text-secondary-500">Call ID</p>
                  <p className="text-xs font-mono text-secondary-600 break-all">{lead.callId}</p>
                </div>
                {lead.callDuration && (
                  <div>
                    <p className="text-sm text-secondary-500">Duration</p>
                    <p className="font-medium text-secondary-900">{formatDuration(lead.callDuration)}</p>
                  </div>
                )}
                {lead.callStartedAt && (
                  <div>
                    <p className="text-sm text-secondary-500">Started</p>
                    <p className="text-sm text-secondary-700">{formatDate(lead.callStartedAt)}</p>
                  </div>
                )}
                {lead.callEndedAt && (
                  <div>
                    <p className="text-sm text-secondary-500">Ended</p>
                    <p className="text-sm text-secondary-700">{formatDate(lead.callEndedAt)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Timeline</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-secondary-500">Created</p>
                <p className="text-sm font-medium text-secondary-900">{formatDate(lead.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-secondary-500">Last Updated</p>
                <p className="text-sm font-medium text-secondary-900">{formatDate(lead.updatedAt)}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <a
                href={`mailto:${lead.email}?subject=Following up on your inquiry`}
                className="btn-secondary w-full justify-start"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m22 6-10 7L2 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Send Email
              </a>
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="btn-secondary w-full justify-start"
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Call
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
