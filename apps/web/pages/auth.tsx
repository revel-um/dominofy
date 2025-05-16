import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { FcGoogle } from 'react-icons/fc';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function AuthPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) router.replace('/dominofy');
  }, [router]);

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    if (isSignup && password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const url = isSignup
        ? 'http://localhost:3001/api/v1/user'
        : 'http://localhost:3001/api/v1/user/login';
      const payload = isSignup
        ? { name, email, password }
        : { email, password };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = response.data;

      // Handle specific status codes
      if (isSignup && response.status === 409) {
        throw new Error('UserAlreadyExists');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      router.push('/dominofy');
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error('User already exists. Please log in instead.');
      } else if (err.message === 'UserAlreadyExists') {
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
            “Give your developers a break—accomplish more without extra hires.”
          </blockquote>
        </div>

        {/* Right Auth Form */}
        <div className="flex items-center justify-center p-8 bg-gray-100">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
            {/* Header & Toggle */}
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center">
              <div>
                <h2 className="text-3xl font-bold">
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
                      className="text-sm font-semibold text-blue-600"
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
                      className="text-sm font-semibold text-blue-600"
                    >
                      Sign up here
                    </button>
                  </>
                )}
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
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              )}
              <input
                type="email"
                placeholder="Your Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
              <input
                type="password"
                placeholder="Your Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
              {isSignup && (
                <input
                  type="password"
                  placeholder="Confirm Your Password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Log In'}
              </button>
            </form>

            {/* Google Auth */}
            <div className="flex items-center justify-center space-x-2">
              <span className="text-gray-500">Or</span>
            </div>
            <button
              onClick={() => {
                // trigger Google OAuth
            }}
              className="w-full py-3 flex items-center justify-center bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition"
            >
              <FcGoogle className="mr-2 text-lg" />
              {isSignup ? 'Sign up with Google' : 'Log in with Google'}
            </button>
          </div>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar />
    </>
  );
}