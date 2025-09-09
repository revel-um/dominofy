import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signIn, useSession, signOut } from 'next-auth/react';
import axios from 'axios';
import { OAuthButtons } from '../components/auth/OAuthButtons';
import { FcGoogle } from 'react-icons/fc';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function AuthPage() {
  const router = useRouter();
  const { status } = useSession();
  const [isSignup, setIsSignup] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    // Only auto-redirect when a backend token exists; do not auto-redirect just because NextAuth has a session
    if (token) {
      router.push('/dashboard');
    } else {
      setCheckingAuth(false);
    }

    // Check for OAuth errors in URL
    const { error } = router.query;
    if (error) {
      let errorMessage = 'Authentication failed';
      if (typeof error === 'string') {
        errorMessage = decodeURIComponent(error);
      }
      toast.error(errorMessage);
    }
  }, [router]);

  if (checkingAuth) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localStorage.getItem('token')) {
      router.push('/dashboard');
      return;
    }
    if (isSignup && password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      let resp;
      if (isSignup) {
        resp = await axios.post(
          'http://localhost:3001/api/v1/user',
          { name, email, password },
          { headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        resp = await axios.post(
          'http://localhost:3001/api/v1/user/login',
          { email, password },
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      const data = resp.data;
      if (data.token) {
        localStorage.setItem('token', data.token);
        router.push('/dashboard');
      } else {
        throw new Error('No token returned');
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error('User already exists. Please log in instead.');
      } else {
        toast.error(err.response?.data?.message || err.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        {/* Left Marketing Panel */}
        <div className="bg-blue-600 p-8 flex flex-col justify-center items-center text-white space-y-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-center">
            Join Us and Unlock Endless Possibilities!
          </h1>
          <p className="text-base md:text-lg max-w-sm text-center">
            Welcome to Dominofy, where your journey begins. Sign up now to automate tasks, streamline workflows, and supercharge productivity.
          </p>
          <img
            src="/departing.svg"
            alt="Workflow illustration"
            className="w-32 h-auto mt-4"
          />
          <blockquote className="italic text-sm opacity-75 text-center max-w-xs mt-4">
            "Give your developers a break—accomplish more without extra hires."
          </blockquote>
        </div>

        {/* Right Auth Form */}
        <div className="flex items-center justify-center p-8 bg-gray-100">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
            {/* Header & Toggle */}
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center">
              <div>
                <h2 className="text-3xl font-bold text-black">
                  {isSignup ? 'Sign up to' : 'Log in to'}
                </h2>
                <span className="block text-3xl font-bold text-blue-600">
                  Dominofy
                </span>
              </div>
              <div className="mt-4 sm:mt-0 text-right">
                {isSignup ? (
                  <>
                    <span className="text-sm text-gray-500 block">
                      Already a member?
                    </span>
                    <button
                      onClick={() => setIsSignup(false)}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Log in here
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-500 block">
                      New here?
                    </span>
                    <button
                      onClick={() => setIsSignup(true)}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Sign up here
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* OAuth Buttons */}
            <OAuthButtons />

            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or sign in with email</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <input
                  type="text"
                  placeholder="Your Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  required
                />
              )}
              <input
                type="email"
                placeholder="Your Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                required
              />
              <input
                type="password"
                placeholder="Your Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                required
              />
              {isSignup && (
                <input
                  type="password"
                  placeholder="Confirm Your Password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  required
                />
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Log In'}
              </button>
            </form>

            {/* OAuthButtons already renders providers; removed duplicate Google button */}
          </div>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar />
    </>
  );
}