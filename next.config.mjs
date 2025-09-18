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
      {
        source: '/:all*(gltf|glb|ktx2|basis|wasm|mp3|opus)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' }
        ],
      },
    ];
  },
  // Reduce bundle size
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  // API route body size limit
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
  i18n: {
    defaultLocale: 'he',
    locales: ['he', 'en'],
    localeDetection: false,
  },
};

export default nextConfig;
