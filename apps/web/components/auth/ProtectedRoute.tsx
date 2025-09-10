import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    // If session is loading, wait
    if (status === 'loading') return;

    // If user is not authenticated, redirect to sign-in
    if (!session) {
      // Store the current URL for redirecting back after sign-in
      const callbackUrl = router.asPath === '/auth' ? '/dashboard' : router.asPath;
      router.push(`/auth?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    // If we get here, user is authenticated
    setIsAuthorized(true);
  }, [session, status, router]);

  // Show loading state while checking auth
  if (status === 'loading' || isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If not authorized (should be handled by the redirect above)
  if (!isAuthorized) {
    return null;
  }

  // If authorized, render the children
  return <>{children}</>;
}
