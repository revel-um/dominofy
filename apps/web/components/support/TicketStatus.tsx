import React from 'react';

interface Props {
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: 'billing' | 'technical' | 'general';
}

export default function TicketStatus({ status, category }: Props) {
  const statusStyles = {
    open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  };

  const categoryStyles = {
    billing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    technical: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    general: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  };

  return (
    <div className="flex space-x-2">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}>
        {status.replace('_', ' ')}
      </span>
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryStyles[category]}`}>
        {category}
      </span>
    </div>
  );
}