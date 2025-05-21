// components/Layout.tsx
import SideNavbar from "../components/navbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <SideNavbar />
      <main className="flex-1 bg-gray-100 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
