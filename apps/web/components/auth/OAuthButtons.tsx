import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';

export function OAuthButtons() {
  const router = useRouter();
  const { callbackUrl } = router.query;

  const handleOAuthSignIn = (provider: 'google' | 'github') => {
    // Use the callbackUrl from query params or default to '/dashboard'
    const redirectTo = typeof callbackUrl === 'string' ? callbackUrl : '/dashboard';
    signIn(provider, { callbackUrl: redirectTo });
  };

  return (
    <div className="space-y-4 mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleOAuthSignIn('google')}
          type="button"
          className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FcGoogle className="w-5 h-5" />
          <span className="ml-2">Google</span>
        </button>

        <button
          onClick={() => handleOAuthSignIn('github')}
          type="button"
          className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FaGithub className="w-5 h-5" />
          <span className="ml-2">GitHub</span>
        </button>
      </div>
    </div>
  );
}
