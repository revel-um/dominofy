import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { ResponsiveContainer } from '../components/common/ResponsiveComponents';
import { 
  FiUser, 
  FiBell, 
  FiShield, 
  FiMonitor, 
  FiSettings, 
  FiInfo
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

// Default settings to avoid hydration mismatch
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
  timezone: 'UTC',};

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  role: string;
  createdAt: string;
  lastLogin: string;
}

const SectionHeader = ({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description?: string; 
}) => (
  <div className="mb-6">
    <div className="flex items-center space-x-3">
      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
    </div>
  </div>
);

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
    lastLogin: new Date().toISOString()
  });
  const [isEditing, setIsEditing] = useState(false);
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);

  // Populate profile from NextAuth session; later we can enrich with backend details
  useEffect(() => {
    setMounted(true);
    if (status === 'loading') return; // wait for session

    const syncProfile = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        // If authenticated with NextAuth but no backend token, try to exchange it
        if (!token && status === 'authenticated') {
          setIsExchanging(true);
          try {
            const resp = await fetch('/api/auth/exchange', { method: 'POST' });
            if (resp.ok) {
              const data = await resp.json();
              if (data?.accessToken && data?.refreshToken) {
                TokenManager.setTokens(data.accessToken, data.refreshToken);
              }
            } else {
              // If exchange fails, we will fall back to session-only details
              const text = await resp.text();
              console.warn('Token exchange failed on settings page:', text);
            }
          } catch (e) {
            console.error('Token exchange error on settings page:', e);
          } finally {
            setIsExchanging(false);
          }
        }

        const backendToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (backendToken) {
          // Fetch user via same backend call the dashboard uses, to keep data in sync
          const wfResp = await WorkflowsApi.getRecentWorkflowsAndCount(backendToken, router);
          if (wfResp?.ok) {
            const { user } = await wfResp.json();
            if (user) {
              setProfile(prev => ({
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

        // Fallback: use NextAuth session if available
        if (status === 'authenticated' && session?.user) {
          const user = session.user as any;
          setProfile(prev => ({
            ...prev,
            name: user?.name || prev.name,
            email: user?.email || prev.email,
            avatar: user?.image || prev.avatar,
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProfile(prev => ({
        ...prev,
        ...updatedData
      }));
      
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const handlePasswordChange = async (oldPassword: string, newPassword: string): Promise<void> => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setShowPasswordModal(false);
      toast.success('Password changed successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
      throw error; // Re-throw to allow the modal to handle the error state
    }
  };

  if (!mounted) {
    return null; // Prevent SSR mismatch
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dominofy-light-background dark:bg-dominofy-dark-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dominofy-light-background dark:bg-dominofy-dark-background">
      <div className="w-full p-0 m-0">
        <div className="w-full space-y-2 px-4 sm:px-6">
          <div className="flex items-center justify-between mb-2 pt-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
          
          <div className="space-y-3">
            {/* Profile Section */}
            <div className="bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <SectionHeader 
                  icon={<FiUser className="w-5 h-5" />} 
                  title="Profile Information"
                />
              </div>
              <div className="p-3">
                <div className="px-2 sm:px-3 pb-2 space-y-2">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-2xl text-white">
                        {profile.avatar ? (
                          <img 
                            src={profile.avatar} 
                            alt={profile.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>{profile.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile({...profile, name: e.target.value})}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            placeholder="Full Name"
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => updateProfile(profile)}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setIsEditing(false)}
                              className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h2 className="text-xl font-semibold">{profile.name || 'User'}</h2>
                          <p className="text-gray-600 dark:text-gray-300">{profile.email || 'user@example.com'}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{profile.role || 'User'}</p>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Edit Profile
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* General Settings */}
            <div className="bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <SectionHeader 
                  icon={<FiSettings className="w-5 h-5" />} 
                  title="General Settings"
                />
              </div>
              <div className="p-3">
                <GeneralSettings settings={settings} setSettings={setSettings} />
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <SectionHeader 
                  icon={<FiBell className="w-5 h-5" />} 
                  title="Notifications"
                />
              </div>
              <div className="p-3">
                <NotificationSettings settings={settings} setSettings={setSettings} />
              </div>
            </div>

            {/* Security */}
            <div className="bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <SectionHeader 
                  icon={<FiShield className="w-5 h-5" />} 
                  title="Security"
                />
              </div>
              <div className="p-3">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Password</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Last changed 3 months ago</p>
                    </div>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="px-3 py-1 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                  <SecuritySettings />
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <SectionHeader 
                  icon={<FiMonitor className="w-5 h-5" />} 
                  title="Appearance"
                />
              </div>
              <div className="p-3">
                <AppearanceSettings settings={settings} setSettings={setSettings} />
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="p-4">
                <SectionHeader 
                  icon={<FiInfo className="w-5 h-5" />} 
                  title="Account Information"
                />
                <div className="mt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-gray-900 dark:text-white">{profile.email || 'user@example.com'}</p>
                    </div>
                    <button className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                      Change
                    </button>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Member Since</p>
                      <p className="text-gray-900 dark:text-white">
                        {new Date(profile.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                      {profile.role || 'User'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ChangePasswordModal
            isOpen={showPasswordModal}
            onClose={() => setShowPasswordModal(false)}
            onSubmit={handlePasswordChange}
          />
        </div>
      </div>
    </div>
  );
}

// Prevent hydration mismatch by disabling SSR for the settings page
const SettingsPage = dynamic(() => Promise.resolve(SettingsComponent), {
  ssr: false,
});

export default SettingsPage;
