import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    const redirect = async () => {
      toast.info('Profile settings have been moved to the Settings page', {
        autoClose: 3000,
        hideProgressBar: true,
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      router.replace('/settings');
    };
    
    redirect();
  }, [router]);

  return null;
}