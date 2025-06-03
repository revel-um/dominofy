import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ErrorPage() {
    const router = useRouter();
    const [errorMessage, setErrorMessage] = useState("Something went wrong");

    useEffect(() => {
        setErrorMessage(sessionStorage.getItem("error-message") || "Something went wrong");
        sessionStorage.removeItem("error-message");
    }, []);

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 px-4">
            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold text-gray-800">{errorMessage}</h1>
                <p className="text-sm text-gray-600">An unexpected error occurred. Please try again.</p>
                <div className="flex justify-center gap-3">
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 text-sm"
                    >
                        Home
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}
