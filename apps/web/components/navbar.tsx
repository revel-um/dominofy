import {
  FiHome,
  FiGrid,
  FiSettings,
  FiLogOut,
  FiHeadphones,
  FiMenu,
  FiX,
  FiCode,
  FiShield
} from "react-icons/fi";
import { useRouter } from "next/router";
import { ReactElement, useState, useEffect } from "react";
import { handleUnauthorizedError } from "../utils/error.handler";
import { useResponsive } from "../contexts/responsiveContext";

interface NavItemProps {
  label: string;
  icon: ReactElement;
  href: string;
  action?: () => Promise<void> | void;
}

const navItems: NavItemProps[] = [
  { label: "Dashboard", icon: <FiHome />, href: "/dashboard" },
  { label: "Overview", icon: <FiGrid />, href: "/overview" },
  { label: "Code Editor", icon: <FiCode />, href: "/editor" },
  { label: "Support", icon: <FiHeadphones />, href: "/support" },
  { label: "Vault", icon: <FiShield />, href: "/vault" },
  { label: "Settings", icon: <FiSettings />, href: "/settings" },
];

export default function SideNavbar() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isMobile } = useResponsive();

  // Close mobile menu when route changes
  useEffect(() => {
    const handleRouteChange = () => {
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [isMobileMenuOpen, router.events]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const sidebar = document.querySelector('.sidebar');
      const menuButton = document.querySelector('.menu-button');

      if (isMobileMenuOpen &&
        sidebar &&
        !sidebar.contains(target) &&
        menuButton &&
        !menuButton.contains(target)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  const handleNavClick = async (href: string, action?: () => Promise<void> | void) => {
    if (action) await action();
    if (isMobile) setIsMobileMenuOpen(false);
    await router.push(href);
  };

  const handleLogout = async () => {
    await handleUnauthorizedError(router);
    if (isMobile) setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button
        className={`menu-button lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md 
          bg-white dark:bg-gray-800 shadow-md 
          hover:bg-gray-100 dark:hover:bg-gray-700 
          transition-colors duration-200
          ${isMobileMenuOpen ? 'transform rotate-90' : ''}`}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isMobileMenuOpen}
      >
        {isMobileMenuOpen ? (
          <FiX className="h-6 w-6" />
        ) : (
          <FiMenu className="h-6 w-6" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-40 transform 
          lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          group h-screen flex flex-col w-64 lg:w-20 lg:hover:w-64
          bg-white text-gray-900 border-r border-gray-200 
          dark:bg-gray-900 dark:text-white dark:border-gray-700
          shadow-xl lg:shadow-none`}
        aria-label="Sidebar"
      >
        {/* Navigation Items */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = router.pathname === item.href;
            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.href, item.action)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={`text-xl flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  {item.icon}
                </span>
                <span className="whitespace-nowrap overflow-hidden transition-all duration-300">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg 
              text-red-600 dark:text-red-400 
              hover:bg-red-50 dark:hover:bg-red-900/30 
              transition-colors duration-200"
          >
            <FiLogOut className="text-xl flex-shrink-0" />
            <span className="whitespace-nowrap overflow-hidden transition-all duration-300">
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 ease-in-out 
          ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} 
          lg:hidden`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />
    </>
  );
}
