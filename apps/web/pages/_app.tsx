// pages/_app.tsx or ideally pages/_document.tsx
import { useEffect } from 'react';
import '../styles/globals.css';

import type { AppProps } from 'next/app';
import Layout from './layout';
import { NextRouter, useRouter } from 'next/router';
import { ToastContainer } from 'react-toastify';
import { ResponsiveProvider } from '../contexts/responsiveContex';

const EXCLUDED_ROUTES = ['/auth', '/dominofy'];

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, []);
  const router = useRouter();
  const isExcluded = EXCLUDED_ROUTES.some((path) =>
    router.pathname.includes(path)
  );

  return (
    <ResponsiveProvider>
      {isExcluded ? (
        <>
          <Component {...pageProps} />
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnHover
          />
        </>
      ) : (
        <Layout>
          <Component {...pageProps} />
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnHover
          />
        </Layout>
      )}
    </ResponsiveProvider>
  );
}

export default MyApp;
