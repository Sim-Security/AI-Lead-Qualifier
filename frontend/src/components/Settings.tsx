import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

interface ConfigStatus {
  configured: boolean;
  missingKeys: string[];
  hasVapiApiKey: boolean;
  hasVapiWebhookSecret: boolean;
  hasVapiPhoneNumberId: boolean;
  hasAnthropicApiKey: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Settings() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    vapiApiKey: '',
    vapiWebhookSecret: '',
    vapiPhoneNumberId: '',
    anthropicApiKey: '',
  });

  // Fetch current config status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch(`${API_URL}/api/settings/status`);
        const data = await response.json();
        if (data.success) {
          setStatus(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch config status:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Only send non-empty values
      const payload: Record<string, string> = {};
      if (formData.vapiApiKey) payload.vapiApiKey = formData.vapiApiKey;
      if (formData.vapiWebhookSecret) payload.vapiWebhookSecret = formData.vapiWebhookSecret;
      if (formData.vapiPhoneNumberId) payload.vapiPhoneNumberId = formData.vapiPhoneNumberId;
      if (formData.anthropicApiKey) payload.anthropicApiKey = formData.anthropicApiKey;

      const response = await fetch(`${API_URL}/api/settings/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      setSuccess(true);
      // Clear form after successful save
      setFormData({
        vapiApiKey: '',
        vapiWebhookSecret: '',
        vapiPhoneNumberId: '',
        anthropicApiKey: '',
      });

      // Refresh status
      const statusResponse = await fetch(`${API_URL}/api/settings/status`);
      const statusData = await statusResponse.json();
      if (statusData.success) {
        setStatus(statusData.data);
      }

      // Redirect to home if fully configured
      if (data.data?.configured) {
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-3">Settings</h1>
        <p className="text-secondary-600 text-lg">
          Configure your API keys to enable AI voice calling features.
        </p>
      </div>

      {/* Status Card */}
      <div className={clsx(
        'mb-6 p-4 rounded-xl border flex items-start gap-3',
        status?.configured
          ? 'bg-success-50 border-success-200'
          : 'bg-warning-50 border-warning-200'
      )}>
        <div className={clsx(
          'flex-shrink-0 w-5 h-5 mt-0.5',
          status?.configured ? 'text-success-600' : 'text-warning-600'
        )}>
          {status?.configured ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <div>
          <h3 className={clsx(
            'font-medium',
            status?.configured ? 'text-success-800' : 'text-warning-800'
          )}>
            {status?.configured ? 'Fully Configured' : 'Configuration Required'}
          </h3>
          <p className={clsx(
            'text-sm mt-1',
            status?.configured ? 'text-success-700' : 'text-warning-700'
          )}>
            {status?.configured
              ? 'All required API keys are set. You can update them below if needed.'
              : `Missing: ${status?.missingKeys.join(', ').replace(/([A-Z])/g, ' $1').trim()}`}
          </p>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-success-50 border border-success-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-success-600 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <h3 className="font-medium text-success-800">Configuration Saved!</h3>
            <p className="text-sm text-success-700 mt-1">
              Your API keys have been validated and saved.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-danger-600 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <h3 className="font-medium text-danger-800">Error</h3>
            <p className="text-sm text-danger-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6">
        {/* Vapi Section */}
        <div>
          <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500"></span>
            Vapi.ai Configuration
          </h2>
          <p className="text-sm text-secondary-500 mb-4">
            Get your API key from{' '}
            <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              dashboard.vapi.ai
            </a>
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="vapiApiKey" className="label">
                Vapi API Key {!status?.hasVapiApiKey && <span className="text-danger-500">*</span>}
              </label>
              <input
                type="password"
                id="vapiApiKey"
                name="vapiApiKey"
                value={formData.vapiApiKey}
                onChange={handleChange}
                className="input"
                placeholder={status?.hasVapiApiKey ? '••••••••••••••••' : 'Enter your Vapi API key'}
                disabled={saving}
              />
              {status?.hasVapiApiKey && (
                <p className="mt-1 text-sm text-success-600">Currently set</p>
              )}
            </div>

            <div>
              <label htmlFor="vapiWebhookSecret" className="label">
                Webhook Secret <span className="text-secondary-400">(optional)</span>
              </label>
              <input
                type="password"
                id="vapiWebhookSecret"
                name="vapiWebhookSecret"
                value={formData.vapiWebhookSecret}
                onChange={handleChange}
                className="input"
                placeholder={status?.hasVapiWebhookSecret ? '••••••••••••••••' : 'Enter webhook secret'}
                disabled={saving}
              />
              {status?.hasVapiWebhookSecret && (
                <p className="mt-1 text-sm text-success-600">Currently set</p>
              )}
            </div>

            <div>
              <label htmlFor="vapiPhoneNumberId" className="label">
                Phone Number ID {!status?.hasVapiPhoneNumberId && <span className="text-danger-500">*</span>}
              </label>
              <input
                type="text"
                id="vapiPhoneNumberId"
                name="vapiPhoneNumberId"
                value={formData.vapiPhoneNumberId}
                onChange={handleChange}
                className="input"
                placeholder={status?.hasVapiPhoneNumberId ? '••••••••••••••••' : 'Enter Vapi phone number ID'}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-secondary-500">
                Find this in your Vapi dashboard under Phone Numbers
              </p>
              {status?.hasVapiPhoneNumberId && (
                <p className="mt-1 text-sm text-success-600">Currently set</p>
              )}
            </div>
          </div>
        </div>

        {/* Anthropic Section */}
        <div>
          <h2 className="text-lg font-semibold text-secondary-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500"></span>
            Anthropic Configuration
          </h2>
          <p className="text-sm text-secondary-500 mb-4">
            Get your API key from{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              console.anthropic.com
            </a>
          </p>

          <div>
            <label htmlFor="anthropicApiKey" className="label">
              Anthropic API Key {!status?.hasAnthropicApiKey && <span className="text-danger-500">*</span>}
            </label>
            <input
              type="password"
              id="anthropicApiKey"
              name="anthropicApiKey"
              value={formData.anthropicApiKey}
              onChange={handleChange}
              className="input"
              placeholder={status?.hasAnthropicApiKey ? '••••••••••••••••' : 'Enter your Anthropic API key'}
              disabled={saving}
            />
            {status?.hasAnthropicApiKey && (
              <p className="mt-1 text-sm text-success-600">Currently set</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-secondary-200">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-3"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Validating & Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-secondary-500 mt-6">
        Your API keys are stored in server memory only and are never saved to disk.
        They will need to be re-entered if the server restarts.
      </p>
    </div>
  );
}
