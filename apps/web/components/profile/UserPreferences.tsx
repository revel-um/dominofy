import { Switch } from '@headlessui/react';
import { FiMoon, FiBell, FiGlobe } from 'react-icons/fi';

interface UserPreferences {
  darkMode: boolean;
  emailNotifications: boolean;
  language: string;
  timezone: string;
}

interface Props {
  preferences: UserPreferences;
  onUpdate: (preferences: Partial<UserPreferences>) => Promise<void>;
}

export default function UserPreferencesPanel({ preferences, onUpdate }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FiMoon className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Dark Mode
            </p>
            <p className="text-sm text-gray-500">
              Toggle dark mode for better viewing at night
            </p>
          </div>
        </div>
        <Switch
          checked={preferences.darkMode}
          onChange={(checked) => onUpdate({ darkMode: checked })}
          className={`${
            preferences.darkMode ? 'bg-blue-600' : 'bg-gray-200'
          } relative inline-flex h-6 w-11 items-center rounded-full`}
        >
          <span className="sr-only">Enable dark mode</span>
          <span
            className={`${
              preferences.darkMode ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition`}
          />
        </Switch>
      </div>
      {/* Add more preferences */}
    </div>
  );
}