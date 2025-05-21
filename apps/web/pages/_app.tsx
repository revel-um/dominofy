// pages/_app.tsx or ideally pages/_document.tsx
import { useEffect } from 'react';
import '../styles/globals.css';

import type { AppProps } from 'next/app';
import Layout from './layout';
import { NextRouter, useRouter } from 'next/router';

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
  const isExcluded = EXCLUDED_ROUTES.includes(router.pathname);

  return isExcluded ? (
    <Component {...pageProps} />
  ) : (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default MyApp;
