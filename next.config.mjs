import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const webpack = require('webpack');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  },
  // Next.js 16: moved out of experimental
  serverExternalPackages: ['pdfkit'],
  // Next.js 16 defaults to Turbopack for build; keep explicit to avoid mixed-config error
  turbopack: {},
  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  typescript: {
    // Temporary compatibility for Next.js 16 route-handler signature migration.
    ignoreBuildErrors: true,
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
    
    // Use in-memory alasql build (alasql.js) instead of Node/RN fs build (alasql.fs.js)
    // to avoid pulling in react-native-fs and react-native-fetch-blob in Next.js
    const alasqlBase = path.resolve(__dirname, 'node_modules/alasql/dist/alasql.js');
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      alasql: alasqlBase,
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
};

export default nextConfig;
