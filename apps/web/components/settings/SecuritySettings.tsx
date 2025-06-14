import { FiLock, FiShield, FiChevronRight } from 'react-icons/fi';

interface SecuritySettingsProps {
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  securityQuestions: boolean;
}

export default function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Security Settings</h3>
        <div className="mt-4 space-y-4">
          <div className="flex flex-col space-y-2">
            <button className="flex items-center justify-between w-full px-4 py-3 text-left bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
              <div className="flex items-center space-x-3">
                <FiLock className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Change Password
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Update your password
                  </div>
                </div>
              </div>
              <FiChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="flex items-center justify-between w-full px-4 py-3 text-left bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600">
              <div className="flex items-center space-x-3">
                <FiShield className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Two-Factor Authentication
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Add an extra layer of security
                  </div>
                </div>
              </div>
              <FiChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}