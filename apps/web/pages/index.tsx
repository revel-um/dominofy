import { useEffect } from 'react';
import { useRouter } from 'next/router';
import DominofyLayout from './dominofy';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // not logged in → send to auth page
      router.replace('/auth');
    }
  }, [router]);

  // You can optionally show a loader while the redirect is in flight
  // if (!localStorage.getItem('token')) return <p>Loading...</p>;

  return <DominofyLayout />;
}
