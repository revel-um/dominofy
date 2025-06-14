import { useState, useEffect } from 'react';
import { ResponsiveContainer } from '../components/common/ResponsiveComponents';
import { 
  FiUser, 
  FiMail, 
  FiLock, 
  FiSettings, 
  FiKey, 
  FiShield,
  FiChevronRight
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import ActivityHistory from '../components/profile/ActivityHistory';
import SecuritySettings from '../components/profile/SecuritySettings';
import UserPreferences from '../components/profile/UserPreferences';
import ChangePasswordModal from '../components/profile/ChangePasswordModal';

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  role: string;
  createdAt: string;
  lastLogin: string;
}

interface ActivityLog {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

export default function ProfilePage() {
  // Add mounted state to handle client-side only rendering
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    role: '',
    createdAt: '',
    lastLogin: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    loginNotifications: true,
    securityQuestions: false
  });
  const [preferences, setPreferences] = useState({
    darkMode: false,
    emailNotifications: true,
    language: 'en',
    timezone: 'UTC'
  });
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    setMounted(true);
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/user', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updatedData: Partial<UserProfile>) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updatedData)
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        toast.success('Profile updated successfully');
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const handlePasswordChange = async (oldPassword: string, newPassword: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/v1/user/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });

      if (response.ok) {
        toast.success('Password updated successfully');
      } else {
        throw new Error('Failed to update password');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('http://localhost:3001/api/v1/user/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setProfile({ ...profile, avatar: data.avatarUrl });
        toast.success('Avatar updated successfully');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    }
  };

  // Format date in a consistent way between server and client
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Use ISO format parts to create consistent date string
    return date.toISOString().split('T')[0];
  };

  // Show nothing during SSR
  if (!mounted) {
    return null;
  }

  // Show loading state only on client
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  return (
    <ResponsiveContainer>
      <div className="min-h-screen bg-dominofy-light-background dark:bg-dominofy-dark-background">
        {/* Keep only vertical padding */}
        <div className="py-4 sm:py-6">
          {/* Adjust max-width without additional padding */}
          <div className="max-w-3xl mx-auto">
            {/* Profile Header */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                <div className="flex items-center space-x-6">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-2xl text-white">
                      {profile.avatar ? (
                        <img 
                          src={profile.avatar} 
                          alt={profile.name} 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        profile.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <button 
                      className="absolute bottom-0 right-0 bg-gray-100 dark:bg-gray-700 p-2 rounded-full shadow-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                      onClick={() => {/* Handle avatar update */}}
                    >
                      <FiUser className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Basic Info */}
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {profile.name}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">{profile.email}</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {profile.role}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Member since {formatDate(profile.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {/* Personal Information */}
                <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Personal Information
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          disabled={!isEditing}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={profile.email}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                      <div className="flex justify-end">
                        {isEditing ? (
                          <div className="space-x-3">
                            <button
                              onClick={() => setIsEditing(false)}
                              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => updateProfile({ name: profile.name })}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                            >
                              Save Changes
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium"
                          >
                            Edit Profile
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Account Settings
                  </h2>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setShowPasswordModal(true)}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md"
                    >
                      <div className="flex items-center">
                        <FiKey className="mr-3 h-5 w-5 text-gray-400" />
                        <span>Change Password</span>
                      </div>
                      <FiChevronRight className="ml-3 h-5 w-5 text-gray-400" />
                    </button>
                    <button className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md">
                      <div className="flex items-center">
                        <FiShield className="mr-3 h-5 w-5 text-gray-400" />
                        <span>Security Settings</span>
                      </div>
                      <FiChevronRight className="ml-3 h-5 w-5 text-gray-400" />
                    </button>
                    <button className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md">
                      <div className="flex items-center">
                        <FiSettings className="mr-3 h-5 w-5 text-gray-400" />
                        <span>Preferences</span>
                      </div>
                      <FiChevronRight className="ml-3 h-5 w-5 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Activity and Settings Sections */}
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Activity History
                    </h2>
                    <ActivityHistory activities={activities} />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Security Settings
                    </h2>
                    <SecuritySettings
                      settings={securitySettings}
                      onUpdate={async (settings) => {
                        setSecuritySettings({ ...securitySettings, ...settings });
                        // Add API call to update settings
                      }}
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Preferences
                    </h2>
                    <UserPreferences
                      preferences={preferences}
                      onUpdate={async (newPrefs) => {
                        setPreferences({ ...preferences, ...newPrefs });
                        // Add API call to update preferences
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        <ChangePasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSubmit={handlePasswordChange}
        />
      </div>
    </ResponsiveContainer>
  );
}