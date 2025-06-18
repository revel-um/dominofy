import { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export const ResponsiveContainer = ({ children, className = '' }: ContainerProps) => (
  <div className={`w-full max-w-full px-4 sm:px-6 lg:px-8 mx-auto ${className}`}>
    {children}
  </div>
);

export const ResponsiveGrid = ({ children, className = '' }: ContainerProps) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}>
    {children}
  </div>
);

export const ResponsiveCard = ({ children, className = '' }: ContainerProps) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 ${className}`}>
    {children}
  </div>
);