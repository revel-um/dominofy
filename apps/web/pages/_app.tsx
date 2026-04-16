import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { ToastContainer } from 'react-toastify';
import { ResponsiveProvider } from '../contexts/responsiveContext';
import Layout from './layout';
import '../styles/globals.css';

const EXCLUDED_ROUTES = ['/', '/auth', '/dominofy'];

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, []);
  const router = useRouter();
  const isExcluded = EXCLUDED_ROUTES.includes(router.pathname);

  return (
    <SessionProvider session={pageProps.session}>
      <ResponsiveProvider>
        {isExcluded ? (
          <Component {...pageProps} />
        ) : (
          <Layout>
            <Component {...pageProps} />
          </Layout>
        )}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
        />
      </ResponsiveProvider>
    </SessionProvider>
  );
}

export default MyApp;
