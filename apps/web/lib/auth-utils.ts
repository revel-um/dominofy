import { getSession } from 'next-auth/react';
import { GetServerSidePropsContext } from 'next';

// Simple wrapper to check authentication on the server side
export async function requireAuth(context: GetServerSidePropsContext) {
  const session = await getSession(context);
  
  if (!session) {
    return {
      redirect: {
        destination: '/auth',
        permanent: false,
      },
    };
  }

  return { props: { session } };
}
