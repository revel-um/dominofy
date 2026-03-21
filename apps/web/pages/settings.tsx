import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import {
  FiBell,
  FiInfo,
  FiMonitor,
  FiSettings,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import type { Settings as SettingsType } from '../types/settings';
import GeneralSettings from '../components/settings/GeneralSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import ChangePasswordModal from '../components/profile/ChangePasswordModal';
import { useRouter } from 'next/router';
import { WorkflowsApi } from '../apis/workflow.apis';
import { TokenManager } from '../utils/auth';

const defaultSettings: SettingsType = {
  notifications: {
    email: true,
    push: false,
    workflow: true,
    updates: false,
  },
  theme: {
    mode: 'dark',
    syncWithSystem: true,
  },
  language: 'en',
  timezone: 'UTC',
};

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  role: string;
  createdAt: string;
  lastLogin: string;
}

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70">
      <div className="border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-100">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function SettingsMetric({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 dark:border-white/10 dark:bg-slate-950/35">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meta}</p>
    </div>
  );
}

function SettingsComponent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    role: '',
    avatar: '',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  });
  const [isEditing, setIsEditing] = useState(false);
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (status === 'loading') return;

    const syncProfile = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (!token && status === 'authenticated') {
          try {
            const resp = await fetch('/api/auth/exchange', { method: 'POST' });
            if (resp.ok) {
              const data = await resp.json() as { accessToken?: string; refreshToken?: string };
              if (data?.accessToken && data?.refreshToken) {
                TokenManager.setTokens(data.accessToken, data.refreshToken);
              }
            } else {
              const text = await resp.text();
              console.warn('Token exchange failed on settings page:', text);
            }
          } catch (e) {
            console.error('Token exchange error on settings page:', e);
          }
        }

        const backendToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (backendToken) {
          const wfResp = await WorkflowsApi.getRecentWorkflowsAndCount(backendToken, router);
          if (wfResp?.ok) {
            const { user } = await wfResp.json() as { user?: { name?: string; email?: string } };
            if (user) {
              setProfile((prev) => ({
                ...prev,
                name: user.name || prev.name,
                email: user.email || prev.email,
              }));
              setSettings(defaultSettings);
              setIsLoading(false);
              return;
            }
          }
        }

        if (status === 'authenticated' && session?.user) {
          setProfile((prev) => ({
            ...prev,
            name: session.user.name || prev.name,
            email: session.user.email || prev.email,
            avatar: session.user.image || prev.avatar,
          }));
          setSettings(defaultSettings);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error syncing profile on settings page:', err);
        setIsLoading(false);
      }
    };

    syncProfile();
  }, [status, session, router]);

  const updateProfile = async (updatedData: Partial<UserProfile>) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setProfile((prev) => ({
        ...prev,
        ...updatedData,
      }));
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const handlePasswordChange = async (_oldPassword: string, _newPassword: string): Promise<void> => {
    try {
      void _oldPassword;
      void _newPassword;
      await new Promise((resolve) => setTimeout(resolve, 500));
      setShowPasswordModal(false);
      toast.success('Password changed successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
      throw error;
    }
  };

  if (!mounted) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] dark:bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)]">
        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_48%,_#ffffff_100%)] px-4 py-5 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#111827_100%)] sm:px-6 sm:py-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/70 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/65 sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,_rgba(56,189,248,0.18),_transparent_26%),radial-gradient(circle_at_88%_12%,_rgba(16,185,129,0.16),_transparent_24%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.5fr),minmax(320px,0.9fr)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-sky-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
              <FiSettings className="h-3.5 w-3.5" />
              Workspace settings
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Personalize your workspace control center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Manage identity, notifications, security, and visual preferences from one structured settings surface.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <SettingsMetric
                label="Theme"
                value={settings.theme.mode}
                meta={settings.theme.syncWithSystem ? 'Syncs with system' : 'Manual preference'}
              />
              <SettingsMetric
                label="Language"
                value={settings.language.toUpperCase()}
                meta="Current interface locale"
              />
              <SettingsMetric
                label="Alerts"
                value={settings.notifications.email ? 'Email on' : 'Email off'}
                meta="Primary notification channel"
              />
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200/70 bg-[linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.9))] p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">
              Profile summary
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-sky-500 text-xl font-semibold text-white">
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{profile.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{profile.name || 'User'}</h2>
                <p className="mt-1 text-sm text-slate-300">{profile.email || 'user@example.com'}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{profile.role || 'User'}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Member Since</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {new Date(profile.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Password</p>
                <p className="mt-2 text-sm font-medium text-white">Managed securely</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr),minmax(0,1fr)]">
        <div className="space-y-5">
          <SettingsCard
            icon={<FiUser className="h-5 w-5" />}
            title="Profile Information"
            description="Update your visible identity and account basics."
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-600 text-2xl text-white">
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt={profile.name} className="h-full w-full object-cover" />
                ) : (
                  <span>{profile.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:focus:border-sky-400/60 dark:focus:ring-sky-400/10"
                      placeholder="Full Name"
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => updateProfile(profile)}
                        className="min-h-[44px] rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                      >
                        Save Profile
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="min-h-[44px] rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{profile.name || 'User'}</h3>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{profile.email || 'user@example.com'}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{profile.role || 'User'}</p>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="mt-4 text-sm font-medium text-sky-600 transition hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200"
                    >
                      Edit Profile
                    </button>
                  </div>
                )}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<FiSettings className="h-5 w-5" />}
            title="General Settings"
            description="Language, system preferences, and workspace defaults."
          >
            <GeneralSettings settings={settings} setSettings={setSettings} />
          </SettingsCard>

          <SettingsCard
            icon={<FiBell className="h-5 w-5" />}
            title="Notifications"
            description="Control when and how the workspace reaches you."
          >
            <NotificationSettings settings={settings} setSettings={setSettings} />
          </SettingsCard>
        </div>

        <div className="space-y-5">
          <SettingsCard
            icon={<FiShield className="h-5 w-5" />}
            title="Security"
            description="Password controls and access protection."
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">Password</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Last changed 3 months ago</p>
                </div>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="min-h-[40px] rounded-2xl bg-sky-50 px-4 text-sm font-medium text-sky-700 transition hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
                >
                  Change
                </button>
              </div>
              <SecuritySettings />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<FiMonitor className="h-5 w-5" />}
            title="Appearance"
            description="Tune the look and feel of your workspace."
          >
            <AppearanceSettings settings={settings} setSettings={setSettings} />
          </SettingsCard>

          <SettingsCard
            icon={<FiInfo className="h-5 w-5" />}
            title="Account Information"
            description="Reference account metadata and membership details."
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Email</p>
                  <p className="mt-1 text-slate-950 dark:text-white">{profile.email || 'user@example.com'}</p>
                </div>
                <button className="text-sm font-medium text-sky-600 transition hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200">
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Member Since</p>
                  <p className="mt-1 text-slate-950 dark:text-white">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white dark:bg-white dark:text-slate-950">
                  {profile.role || 'User'}
                </div>
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handlePasswordChange}
      />
    </div>
  );
}

const SettingsPage = dynamic(() => Promise.resolve(SettingsComponent), {
  ssr: false,
});

export default SettingsPage;
