import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security headers for production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Static 3D/audio assets - long-term cache
      {
        source: '/:all*(gltf|glb|ktx2|basis|wasm|mp3|opus)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' }
        ],
      },
      // Next.js static chunks with hash - immutable cache
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ],
      },
      // HTML pages - always revalidate to get fresh bundles
      {
        source: '/:path*',
        has: [
          { type: 'header', key: 'accept', value: '(.*text/html.*)' }
        ],
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' }
        ],
      },
    ];
  },
  // Reduce bundle size
  experimental: {
    optimizePackageImports: ['lucide-react'],
    serverComponentsExternalPackages: ['pdfkit'],
  },
  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  // API route body size limit moved to route handlers in app directory
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Suppress critical dependency warnings for talkinghead.mjs dynamic imports
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };
    
    // Ignore react-native modules which alasql tries to import but aren't needed
    // This applies to both server and client builds
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(react-native|react-native-fs|react-native-fetch-blob)$/,
      })
    );
    
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native': false,
      'react-native-fs': false,
      'react-native-fetch-blob': false,
    };
    
    // Handle sql.js and alasql for server-side execution
    if (isServer) {
      // Externalize pdfkit so it can access its font files from node_modules at runtime
      if (!config.externals) {
        config.externals = [];
      }
      if (Array.isArray(config.externals)) {
        config.externals.push('pdfkit');
      }
      
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    
    return config;
  },
  
  
  i18n: {
    defaultLocale: 'he',
    locales: ['he', 'en'],
    localeDetection: false,
  },
};

export default nextConfig;
