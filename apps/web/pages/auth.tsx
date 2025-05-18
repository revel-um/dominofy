import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { FcGoogle } from 'react-icons/fc';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function AuthPage() {
  const router = useRouter();

  // form state
  const [isSignup, setIsSignup] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // New: tracking whether we've checked for token
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 1 & 2. On mount, check token → dashboard
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // use push so URL updates immediately
      router.push('/dashboard');
    } else {
      // no token, show login form
      setCheckingAuth(false);
    }
  }, [router]);

  // don't render your auth form while we're redirecting
  if (checkingAuth) {
    return null; // or a spinner if you like
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // re-check cache
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
      {/* … the rest of your JSX remains unchanged … */}
    </>
  );
}
