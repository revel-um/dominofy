import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { config } from '../config/config';

export default function AcceptInvitePage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [workspaceName, setWorkspaceName] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady || !token) return;

    const loadInvitation = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${config.backendBaseUrl}/workspace/invitations/${token}`);
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          setError(payload?.message || 'This invitation link is invalid or expired.');
          return;
        }

        setWorkspaceName(payload?.workspaceName || 'Dominofy workspace');
        setEmail(payload?.email || '');
        setName(payload?.invitedUserName || '');
        setRequiresPasswordSetup(payload?.requiresPasswordSetup !== false);
      } catch (err) {
        console.error('Failed to load invitation', err);
        setError('This invitation link is invalid or expired.');
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [router.isReady, token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    if (requiresPasswordSetup) {
      if (!name.trim()) {
        setError('Enter your name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(`${config.backendBaseUrl}/workspace/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          requiresPasswordSetup
            ? { name: name.trim(), password }
            : { name: name.trim() || undefined },
        ),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message || 'Failed to accept invitation.');
        return;
      }

      toast.success(`Workspace access enabled for ${workspaceName}`);
      router.push('/auth');
    } catch (err) {
      console.error('Failed to accept invitation', err);
      setError('Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] px-4 py-8 dark:bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#111827_100%)]">
      <div className="w-full max-w-lg rounded-[28px] border border-white/70 bg-white/85 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/75">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
          Workspace invitation
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Join {workspaceName}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {requiresPasswordSetup
            ? 'Create your password to accept this Dominofy workspace invitation.'
            : 'Accept this Dominofy workspace invitation for your existing account.'}
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="min-h-[48px] w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400"
            />
          </div>
          {requiresPasswordSetup ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="min-h-[48px] w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-[48px] w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="min-h-[48px] w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                />
              </div>
            </>
          ) : (
            <p className="rounded-[18px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-300">
              This invitation is for an account that already exists in Dominofy. Accept it to activate workspace access.
            </p>
          )}

          {error ? (
            <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-[18px] bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? (requiresPasswordSetup ? 'Setting up account...' : 'Accepting invitation...')
              : (requiresPasswordSetup ? 'Create password and accept invite' : 'Accept workspace invite')}
          </button>
        </form>
      </div>
    </div>
  );
}
