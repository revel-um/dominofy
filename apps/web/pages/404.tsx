// pages/404.tsx

import Link from "next/link";
import { FiAlertCircle } from "react-icons/fi";

export default function Custom404() {
    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-4">
            <FiAlertCircle className="w-20 h-20 text-red-500 mb-4" />
            <h1 className="text-4xl font-bold mb-2">404 - Page Not Found</h1>
            <p className="text-lg mb-6 text-center">Sorry, the page you're looking for doesn't exist.</p>
            <Link
                href="/"
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
                Go back home
            </Link>
        </div>
    );
}
