import React, { useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Building2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { getStoredAuthSession, registerClientWithBackend } from '../../services/auth';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const existingSession = getStoredAuthSession();
  const [form, setForm] = useState({ name: '', email: '', password: '', clientName: '', phone: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (existingSession?.token) {
    return <Navigate to="/" replace />;
  }

  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await registerClientWithBackend(form);
      navigate('/client-portal', { replace: true });
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : 'Unable to create the account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/50 sm:p-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-700">Client access</p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Create your account</h1>
            <p className="mt-2 text-sm text-slate-500">Connect to projects assigned to your client profile.</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Building2 className="h-6 w-6" />
          </div>
        </div>

        <form className="space-y-4" onSubmit={submit} noValidate>
          <label className="block text-sm font-semibold text-slate-700">Your name
            <div className="relative mt-2"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required value={form.name} onChange={(event) => update('name', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none" autoComplete="name" /></div>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Work email
            <div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none" autoComplete="email" /></div>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Password
            <div className="relative mt-2"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required minLength={8} type="password" value={form.password} onChange={(event) => update('password', event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none" autoComplete="new-password" /></div>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Company or client name
            <input value={form.clientName} onChange={(event) => update('clientName', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none" autoComplete="organization" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Phone <span className="font-normal text-slate-400">(optional)</span>
            <input value={form.phone} onChange={(event) => update('phone', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none" autoComplete="tel" />
          </label>

          {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /><span>{error}</span></div>}
          <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? 'Creating account...' : 'Create client account'} {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-bold text-brand-700 hover:text-brand-800">Sign in</Link></p>
      </div>
    </div>
  );
};

export default RegisterPage;
