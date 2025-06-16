import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Tempogregergeg() {
    const router = useRouter();

    useEffect(() => {
        document.title = "Something went wrong";
        console.log("AWdawd")
    }, []);

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 px-4">
            <div className="text-center space-y-4 max-w-sm">
                <h1 className="text-3xl font-bold text-gray-800">Something went wrong</h1>
                <p className="text-sm text-gray-600">An unexpected error occurred. Please try again.</p>
                <div className="flex justify-center gap-3">
                   sdvssbsfrgiberhk
                </div>
            </div>
        </div>
    );
}
