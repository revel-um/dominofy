import { useEffect } from 'react';
import { useRouter } from 'next/router';
import DominofyDashboard from './dashboard';   // ⬅️ import the new dashboard

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // not logged in → send to auth page
      router.push('/auth');
    } else {
      // logged in → send to dashboard
      router.push('/dashboard');
    }
  }, [router]);

  // If you want a loader while redirecting, uncomment below:
  // if (!localStorage.getItem('token')) return <p>Loading...</p>;

  return <DominofyDashboard />;
}
