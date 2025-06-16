import { Switch } from '@headlessui/react';
import { FiShield, FiSmartphone, FiLock } from 'react-icons/fi';

interface SecuritySettings {
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  securityQuestions: boolean;
}

interface Props {
  settings: SecuritySettings;
  onUpdate: (settings: Partial<SecuritySettings>) => Promise<void>;
}

export default function SecuritySettingsPanel({ settings, onUpdate }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FiSmartphone className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Two-Factor Authentication
            </p>
            <p className="text-sm text-gray-500">
              Add an extra layer of security to your account
            </p>
          </div>
        </div>
        <Switch
          checked={settings.twoFactorEnabled}
          onChange={(checked) => onUpdate({ twoFactorEnabled: checked })}
          className={`${
            settings.twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200'
          } relative inline-flex h-6 w-11 items-center rounded-full`}
        >
          <span className="sr-only">Enable two-factor authentication</span>
          <span
            className={`${
              settings.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition`}
          />
        </Switch>
      </div>
      {/* Add more security settings */}
    </div>
  );
}