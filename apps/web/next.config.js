/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_DEV_MODE: process.env.DEV_MODE ?? process.env.NEXT_PUBLIC_DEV_MODE ?? 'false',
  },
  transpilePackages: ['shared'],
  webpack: (config, { isServer }) => {
    // Add path aliases
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': require('path').resolve(__dirname, './'),
      };
      
      // Add fallbacks for Node.js modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }

    // Disable webpack cache to prevent file system errors on Windows
    config.cache = false;
    
    return config;
  },
};

module.exports = nextConfig;
