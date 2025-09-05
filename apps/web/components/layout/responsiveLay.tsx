import { ReactNode, useEffect, useState } from 'react';
import { useResponsive } from '../../contexts/responsiveContex';
import SideNavbar from '../navbar';
import Head from 'next/head';
import { FiHome, FiGrid, FiHeadphones, FiUser } from 'react-icons/fi';

interface Props {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export default function ResponsiveLayout({
  children,
  className = '',
  title = 'Dominofy',
  description = 'Modern project management platform'
}: Props) {
  const { isMobile } = useResponsive();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }


  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <SideNavbar />

        <main
          className={`
            flex-1 transition-all duration-300 ease-in-out
            ${isMobile ? 'pt-16' : 'lg:ml-20 lg:group-hover:ml-64'}
            ${className}
          `}
        >
          <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        {isMobile && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40">
            <div className="flex justify-around items-center h-16">
              {['/dashboard', '/overview', '/support', '/profile'].map((path) => (
                <a
                  key={path}
                  href={path}
                  className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <span className="text-xl">
                    {path === '/dashboard' && <FiHome />}
                    {path === '/overview' && <FiGrid />}
                    {path === '/support' && <FiHeadphones />}
                    {path === '/profile' && <FiUser />}
                  </span>
                  <span className="text-xs mt-1">
                    {path.replace('/', '').charAt(1).toUpperCase() + path.slice(2)}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}