    import { ReactNode } from 'react';
    import SideNavbar from '../navbar';

    interface Props {
    children: ReactNode;
    }

    export default function PageLayout({ children }: Props) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <SideNavbar />
        <div className="lg:ml-20 lg:group-hover:ml-64 transition-all duration-300">
            <main className="p-4 sm:p-6 lg:p-8">
            {children}
            </main>
        </div>
        </div>
    );
    }