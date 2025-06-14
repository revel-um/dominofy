import { Switch } from '@headlessui/react';

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
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h3>
          <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
        </div>
        <Switch
          checked={settings.twoFactorEnabled}
          onChange={(checked) => onUpdate({ twoFactorEnabled: checked })}
          className={`${
            settings.twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200'
          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
        >
          <span className="sr-only">Enable two-factor authentication</span>
          <span
            className={`${
              settings.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
          />
        </Switch>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Login Notifications</h3>
          <p className="text-sm text-gray-500">Get notified of new sign-ins to your account</p>
        </div>
        <Switch
          checked={settings.loginNotifications}
          onChange={(checked) => onUpdate({ loginNotifications: checked })}
          className={`${
            settings.loginNotifications ? 'bg-blue-600' : 'bg-gray-200'
          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
        >
          <span className="sr-only">Enable login notifications</span>
          <span
            className={`${
              settings.loginNotifications ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
          />
        </Switch>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Security Questions</h3>
          <p className="text-sm text-gray-500">Set up security questions for account recovery</p>
        </div>
        <Switch
          checked={settings.securityQuestions}
          onChange={(checked) => onUpdate({ securityQuestions: checked })}
          className={`${
            settings.securityQuestions ? 'bg-blue-600' : 'bg-gray-200'
          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
        >
          <span className="sr-only">Enable security questions</span>
          <span
            className={`${
              settings.securityQuestions ? 'translate-x-6' : 'translate-x-1'
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
          />
        </Switch>
      </div>
    </div>
  );
}