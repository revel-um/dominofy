import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: 'Access was denied by the provider or the requested permissions were not granted.',
  Callback: 'The sign-in flow did not complete successfully. Please try again.',
  Configuration: 'Authentication is not configured correctly right now. Please try again shortly.',
  OAuthAccountNotLinked:
    'This email is already linked to a different sign-in method. Please use the original provider.',
  OAuthCallback:
    'We received the provider response, but the sign-in session could not be completed. Please try again in a fresh window.',
  OAuthCreateAccount: 'We could not create your account from the provider response. Please try again.',
  OAuthSignin: 'We could not start the provider sign-in flow. Please try again.',
  SessionRequired: 'You need to sign in to continue.',
  Verification: 'The verification request is invalid or has expired. Please try again.',
};

export default function AuthErrorPage() {
  const router = useRouter();
  const errorCode =
    typeof router.query.error === 'string' ? router.query.error : 'OAuthCallback';
  const callbackUrl =
    typeof router.query.callbackUrl === 'string' && router.query.callbackUrl
      ? router.query.callbackUrl
      : '/dashboard';

  const message =
    ERROR_MESSAGES[errorCode] ||
    'Something went wrong during authentication. Please try signing in again.';

  const retryHref = `/auth?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <>
      <Head>
        <title>Authentication Error | Dominofy</title>
      </Head>

      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="bg-blue-600 p-8 flex flex-col justify-center items-center text-white space-y-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-center">
            Sign-in Hit a Snag
          </h1>
          <p className="text-base md:text-lg max-w-sm text-center">
            Your workflow is still safe. We just need one more clean authentication attempt
            to get you back into Dominofy.
          </p>
          <img
            src="/departing.svg"
            alt="Workflow illustration"
            className="w-32 h-auto mt-4"
          />
          <blockquote className="italic text-sm opacity-75 text-center max-w-xs mt-4">
            "Automation should feel smoother than this, and we can get it there."
          </blockquote>
        </div>

        <div className="flex items-center justify-center p-8 bg-gray-100">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                Authentication Error
              </span>
              <div>
                <h2 className="text-3xl font-bold text-black">We could not complete sign-in</h2>
                <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Error Code
              </p>
              <p className="mt-2 font-mono text-sm text-gray-800">{errorCode}</p>
            </div>

            <div className="space-y-3">
              <Link
                href={retryHref}
                className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Back To Sign In
              </Link>
              <Link
                href="/"
                className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Go Home
              </Link>
            </div>

            <p className="text-xs leading-5 text-gray-500">
              If this keeps happening, clear cookies for <span className="font-mono">localhost</span>{' '}
              and try again in a fresh incognito window.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
