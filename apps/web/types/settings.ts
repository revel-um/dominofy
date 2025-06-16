export interface ThemeSettings {
  mode: 'light' | 'dark';
  syncWithSystem: boolean;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  workflow: boolean;
  updates: boolean;
}

export interface Settings {
  theme: ThemeSettings;
  notifications: NotificationSettings;
  language: string;
  timezone: string;
}

export interface SettingsProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}