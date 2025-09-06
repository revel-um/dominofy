import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const { token, provider, error } = router.query;

    if (error) {
      setStatus('Authentication failed. Redirecting...');
      setTimeout(() => {
        router.push('/auth?error=' + error);
      }, 2000);
      return;
    }

    if (token) {
      // Store the token in localStorage
      localStorage.setItem('token', token as string);
      
      // Store user info if available
      if (provider) {
        localStorage.setItem('authProvider', provider as string);
      }

      setStatus('Authentication successful! Redirecting...');
      
      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } else {
      setStatus('No token received. Redirecting...');
      setTimeout(() => {
        router.push('/auth?error=no_token');
      }, 2000);
    }
  }, [router.query]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Head>
        <title>Authenticating - Dominofy</title>
      </Head>
      
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {status}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please wait while we complete your authentication.
          </p>
        </div>
      </div>
    </div>
  );
}
