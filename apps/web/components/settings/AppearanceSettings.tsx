import { FiMoon, FiSun } from 'react-icons/fi';
import type { SettingsProps } from '../../types/settings';

export default function AppearanceSettings({ settings, setSettings }: SettingsProps) {
  const toggleTheme = (mode: 'light' | 'dark') => {
    setSettings({
      ...settings,
      theme: {
        ...settings.theme,
        mode,
      },
    });
    document.documentElement.classList.toggle('dark', mode === 'dark');
    localStorage.setItem('theme', mode);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Theme Settings</h3>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => toggleTheme('light')}
          className={`p-4 border rounded-lg text-center ${
            settings.theme.mode === 'light'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <FiSun className="w-6 h-6 mx-auto mb-2 text-gray-900 dark:text-white" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Light</span>
        </button>

        <button
          onClick={() => toggleTheme('dark')}
          className={`p-4 border rounded-lg text-center ${
            settings.theme.mode === 'dark'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <FiMoon className="w-6 h-6 mx-auto mb-2 text-gray-900 dark:text-white" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Dark</span>
        </button>
      </div>
    </div>
  );
}