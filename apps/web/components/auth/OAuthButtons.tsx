import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import { useState, useEffect } from 'react';

export function OAuthButtons() {
  const [googleUrl, setGoogleUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');

  useEffect(() => {
    // Fetch OAuth URLs from backend
    const fetchOAuthUrls = async () => {
      try {
        const [googleResponse, githubResponse] = await Promise.all([
          fetch('/api/oauth/google/url'),
          fetch('/api/oauth/github/url')
        ]);
        
        const googleData = await googleResponse.json();
        const githubData = await githubResponse.json();
        
        setGoogleUrl(googleData.url);
        setGithubUrl(githubData.url);
      } catch (error) {
        console.error('Failed to fetch OAuth URLs:', error);
      }
    };

    fetchOAuthUrls();
  }, []);

  const handleOAuthSignIn = (provider: 'google' | 'github') => {
    const url = provider === 'google' ? googleUrl : githubUrl;
    if (url) {
      window.location.href = url;
    }
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
