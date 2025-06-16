import { FiClock, FiUser, FiMapPin } from 'react-icons/fi';

interface ActivityLog {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
  location?: string;
}

interface Props {
  activities: ActivityLog[];
}

export default function ActivityHistory({ activities }: Props) {
  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
        >
          <div className="flex-shrink-0">
            <FiClock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {activity.description}
            </p>
            <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
              <span>{new Date(activity.timestamp).toLocaleString()}</span>
              {activity.ipAddress && (
                <span className="flex items-center">
                  <FiMapPin className="w-3 h-3 mr-1" />
                  {activity.ipAddress}
                </span>
              )}
              {activity.location && <span>{activity.location}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}