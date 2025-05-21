import { FiHome, FiGrid, FiUser, FiSettings, FiLogOut } from "react-icons/fi";
import { useRouter } from "next/router";
import { ReactElement } from "react";
import { handleUnauthorizedError } from "../utils/error.handler";

interface NavItemsProps {
  label: string;
  icon: ReactElement<any, any>;
  href: string;
  action?: Function;
}
const navItems: NavItemsProps[] = [
  { label: "Dashboard", icon: <FiHome />, href: "/dashboard" },
  { label: "Overview", icon: <FiGrid />, href: "/overview" },
  { label: "Profile", icon: <FiUser />, href: "/profile" },
  { label: "Settings", icon: <FiSettings />, href: "/settings" },
];

export default function SideNavbar() {
  const router = useRouter();

  const handleNavClick = async (href: string, label: string, action?: Function) => {
    if (action) await action();
    await router.push(href);
  };

  return (
    <div className="group h-screen flex flex-col transition-all duration-300 w-20 hover:w-64 
                    bg-white text-gray-900 border-r border-gray-200 
                    dark:bg-gray-900 dark:text-white dark:border-gray-700">
      {/* Logo */}
      <div className="text-xl font-bold px-6 py-6 whitespace-nowrap overflow-hidden transition-all duration-300">
        <span className="hidden group-hover:inline">Dominofy</span>
        <span className="group-hover:hidden text-2xl">D</span>
      </div>

      <hr className="border-t border-gray-200 dark:border-gray-700" />

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-4 space-y-2">
        {navItems.map((item) => (
          <div
            key={item.label}
            onClick={() => handleNavClick(item.href, item.label, item.action)}
            className={`flex items-center gap-3 px-4 py-5 rounded-lg cursor-pointer transition-colors
              ${router.pathname === item.href
                ? "bg-gray-100 dark:bg-gray-800"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="whitespace-nowrap overflow-hidden transition-all duration-300 group-hover:inline hidden">
              {item.label}
            </span>
          </div>
        ))}
      </nav>

      {/* Divider */}
      <hr className="border-t border-gray-200 dark:border-gray-700 mx-4 my-2" />

      {/* Logout */}
      <div className="px-2 pb-6">
        <div
          onClick={() => handleUnauthorizedError(router)}
          className="flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer
                     hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-xl">
            <FiLogOut />
          </span>
          <span className="whitespace-nowrap overflow-hidden transition-all duration-300 group-hover:inline hidden">
            Logout
          </span>
        </div>
      </div>
    </div>
  );
}
