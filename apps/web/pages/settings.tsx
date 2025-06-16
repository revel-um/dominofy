import { useState, useEffect } from 'react';
import { ResponsiveContainer } from '../components/common/ResponsiveComponents';
import { FiUser, FiBell, FiShield, FiMonitor } from 'react-icons/fi';
import type { Settings as SettingsType } from '../types/settings';
import GeneralSettings from '../components/settings/GeneralSettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import AppearanceSettings from '../components/settings/AppearanceSettings';
import dynamic from 'next/dynamic';

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
  timezone: 'UTC',
};

function SettingsComponent() {
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Only render on client
  useEffect(() => {
    setMounted(true);
    setTimeout(() => {
      setSettings(defaultSettings);
      setIsLoading(false);
    }, 1000);
  }, []);

  if (!mounted) return null; // Prevent SSR mismatch

  const tabs = [
    { id: 'general', label: 'General', icon: <FiUser /> },
    { id: 'notifications', label: 'Notifications', icon: <FiBell /> },
    { id: 'security', label: 'Security', icon: <FiShield /> },
    { id: 'appearance', label: 'Appearance', icon: <FiMonitor /> },
  ];

  return (
    <ResponsiveContainer>
      <div className="min-h-screen bg-dominofy-light-background dark:bg-dominofy-dark-background">
        <div className="py-6">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow">
              {isLoading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
                </div>
              ) : (
                <>
                  <div className="flex border-b border-gray-200 dark:border-gray-700">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center px-6 py-4 text-sm font-medium transition-colors ${
                          activeTab === tab.id
                            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                      >
                        <span className="mr-2">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="p-6">
                    {activeTab === 'general' && <GeneralSettings settings={settings} setSettings={setSettings} />}
                    {activeTab === 'notifications' && <NotificationSettings settings={settings} setSettings={setSettings} />}
                    {activeTab === 'security' && <SecuritySettings />}
                    {activeTab === 'appearance' && <AppearanceSettings settings={settings} setSettings={setSettings} />}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </ResponsiveContainer>
  );
}

// Prevent hydration mismatch by disabling SSR for the settings page
const SettingsPage = dynamic(() => Promise.resolve(SettingsComponent), {
  ssr: false,
});

export default SettingsPage;