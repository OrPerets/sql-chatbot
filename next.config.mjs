/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable body parser for file uploads
    serverComponentsExternalPackages: ['multer']
  },
  // Ensure static files are served properly
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
