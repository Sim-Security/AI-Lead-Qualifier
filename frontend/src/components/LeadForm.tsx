import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { clsx } from 'clsx';
import { submitLead } from '@/services/api';
import type { CompanySize, LeadFormInput } from '@/types';

// Zod validation schema
const leadFormSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be 50 characters or less'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be 50 characters or less'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[\d\s\-+()]+$/.test(val),
      'Please enter a valid phone number'
    ),
  company: z
    .string()
    .min(1, 'Company name is required')
    .max(100, 'Company name must be 100 characters or less'),
  role: z
    .string()
    .min(1, 'Role is required')
    .max(100, 'Role must be 100 characters or less'),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'], {
    errorMap: () => ({ message: 'Please select a company size' }),
  }),
  request: z
    .string()
    .min(10, 'Please provide at least 10 characters describing your request')
    .max(2000, 'Request must be 2000 characters or less'),
});

type FormErrors = Partial<Record<keyof LeadFormInput, string>>;

const companySizeOptions: { value: CompanySize; label: string }[] = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

const countryCodeOptions = [
  { value: '+1', label: '+1 (US/Canada)' },
  { value: '+44', label: '+44 (UK)' },
  { value: '+61', label: '+61 (Australia)' },
  { value: '+49', label: '+49 (Germany)' },
  { value: '+33', label: '+33 (France)' },
  { value: '+81', label: '+81 (Japan)' },
  { value: '+86', label: '+86 (China)' },
  { value: '+91', label: '+91 (India)' },
];

export default function LeadForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LeadFormInput>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    role: '',
    companySize: '1-10',
    request: '',
  });
  const [countryCode, setCountryCode] = useState('+1');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: submitLead,
    onSuccess: (response) => {
      setSubmitSuccess(true);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        role: '',
        companySize: '1-10',
        request: '',
      });
      // Navigate to the lead detail page after 2 seconds
      // Response now has { leadId, callInitiated } instead of { id }
      setTimeout(() => {
        navigate(`/leads/${response.data.leadId}`);
      }, 2000);
    },
  });

  const validateForm = (): boolean => {
    const result = leadFormSchema.safeParse(formData);

    if (!result.success) {
      const newErrors: FormErrors = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof LeadFormInput;
        if (!newErrors[field]) {
          newErrors[field] = err.message;
        }
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name as keyof LeadFormInput]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);

    if (validateForm()) {
      // Prepend country code to phone if phone is provided
      const submitData = {
        ...formData,
        phone: formData.phone ? `${countryCode}${formData.phone.replace(/[\s\-()]/g, '')}` : '',
      };
      mutation.mutate(submitData);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-3">
          Submit Your Interest
        </h1>
        <p className="text-secondary-600 text-lg">
          Tell us about your needs and we will get back to you with a personalized solution.
        </p>
      </div>

      {submitSuccess && (
        <div className="mb-6 p-4 bg-success-50 border border-success-200 rounded-xl flex items-start gap-3">
          <svg
            className="w-5 h-5 text-success-600 mt-0.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <h3 className="font-medium text-success-800">Successfully submitted!</h3>
            <p className="text-sm text-success-700 mt-1">
              Your request has been received. Redirecting to your lead details...
            </p>
          </div>
        </div>
      )}

      {mutation.isError && (
        <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-start gap-3">
          <svg
            className="w-5 h-5 text-danger-600 mt-0.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <h3 className="font-medium text-danger-800">Submission failed</h3>
            <p className="text-sm text-danger-700 mt-1">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 sm:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="label">
              First Name <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className={clsx('input', errors.firstName && 'input-error')}
              placeholder="John"
              disabled={mutation.isPending}
            />
            {errors.firstName && (
              <p className="mt-1.5 text-sm text-danger-600">{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="label">
              Last Name <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className={clsx('input', errors.lastName && 'input-error')}
              placeholder="Doe"
              disabled={mutation.isPending}
            />
            {errors.lastName && (
              <p className="mt-1.5 text-sm text-danger-600">{errors.lastName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="label">
              Email <span className="text-danger-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={clsx('input', errors.email && 'input-error')}
              placeholder="john.doe@company.com"
              disabled={mutation.isPending}
            />
            {errors.email && (
              <p className="mt-1.5 text-sm text-danger-600">{errors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="label">
              Phone <span className="text-secondary-400">(optional - required for AI call)</span>
            </label>
            <div className="flex gap-2">
              <select
                id="countryCode"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="input w-36 flex-shrink-0"
                disabled={mutation.isPending}
              >
                {countryCodeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={clsx('input flex-1', errors.phone && 'input-error')}
                placeholder="5551234567"
                disabled={mutation.isPending}
              />
            </div>
            {errors.phone && (
              <p className="mt-1.5 text-sm text-danger-600">{errors.phone}</p>
            )}
          </div>

          {/* Company */}
          <div>
            <label htmlFor="company" className="label">
              Company <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              id="company"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className={clsx('input', errors.company && 'input-error')}
              placeholder="Acme Inc."
              disabled={mutation.isPending}
            />
            {errors.company && (
              <p className="mt-1.5 text-sm text-danger-600">{errors.company}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="label">
              Your Role <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={clsx('input', errors.role && 'input-error')}
              placeholder="Product Manager"
              disabled={mutation.isPending}
            />
            {errors.role && (
              <p className="mt-1.5 text-sm text-danger-600">{errors.role}</p>
            )}
          </div>

          {/* Company Size */}
          <div className="sm:col-span-2">
            <label htmlFor="companySize" className="label">
              Company Size <span className="text-danger-500">*</span>
            </label>
            <select
              id="companySize"
              name="companySize"
              value={formData.companySize}
              onChange={handleChange}
              className={clsx('input', errors.companySize && 'input-error')}
              disabled={mutation.isPending}
            >
              {companySizeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.companySize && (
              <p className="mt-1.5 text-sm text-danger-600">{errors.companySize}</p>
            )}
          </div>

          {/* Request */}
          <div className="sm:col-span-2">
            <label htmlFor="request" className="label">
              How can we help you? <span className="text-danger-500">*</span>
            </label>
            <textarea
              id="request"
              name="request"
              value={formData.request}
              onChange={handleChange}
              rows={5}
              className={clsx('input resize-none', errors.request && 'input-error')}
              placeholder="Tell us about your needs, challenges, and what you're looking to achieve..."
              disabled={mutation.isPending}
            />
            <div className="flex justify-between mt-1.5">
              {errors.request ? (
                <p className="text-sm text-danger-600">{errors.request}</p>
              ) : (
                <span />
              )}
              <p className="text-sm text-secondary-400">
                {formData.request.length}/2000
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary flex-1 py-3 text-base"
          >
            {mutation.isPending ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-secondary py-3"
          >
            View Dashboard
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-secondary-500 mt-6">
        By submitting this form, you agree to our{' '}
        <a href="#" className="text-primary-600 hover:text-primary-700 underline">
          Privacy Policy
        </a>{' '}
        and{' '}
        <a href="#" className="text-primary-600 hover:text-primary-700 underline">
          Terms of Service
        </a>
        .
      </p>
    </div>
  );
}
