/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['tenor.com', 'media.tenor.com'],
    unoptimized: false,
  },
  // For Vercel deployment
  output: 'standalone',
  // Cache control headers - auto clear cache every 30 minutes for pages
  async headers() {
    return [
      {
        // HTML pages - no cache, always fresh
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // Static assets - cache for 1 year (immutable)
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Next.js static files
        source: '/_next/static/:path*',
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

module.exports = nextConfig;
