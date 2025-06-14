import type { SettingsProps } from '../../types/settings';

export default function NotificationSettings({ settings, setSettings }: SettingsProps) {
  const toggleNotification = (key: 'email' | 'push' | 'workflow' | 'updates') => {
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key],
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notification Preferences</h3>
        <div className="mt-4 space-y-4">
          {(Object.keys(settings.notifications) as Array<keyof typeof settings.notifications>).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {key} Notifications
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive notifications about {key}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleNotification(key)}
                className={`${
                  settings.notifications[key] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors`}
              >
                <span className={`${
                  settings.notifications[key] ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-1`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}